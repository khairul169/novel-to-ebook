import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import fs from "fs/promises";
import { translate, waitFor } from "../../lib/utils";
import {
  ActionSchema,
  ExtractRequestSchema,
  ExtractResponseSchema,
  SnapshotRequestSchema,
  TranslateRequestSchema,
  TranslateResponseSchema,
} from "./schema";
import { execActions, newBrowserPage } from "../../lib/browser";
import type { Page } from "puppeteer";
import { openApi } from "hono-zod-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import {
  extractContent,
  extractElements,
  fetchImage,
  findContentSelector,
  getCleanHTML,
  getSelector,
} from "./utils";
import { addTask, getTasks, setTask, taskEvents } from "./context";
import Epub from "epub-gen";
import { rescanLibrary } from "../library/context";
import path from "path";

const router = new Hono();

// Get web snapshot and elements
router.post(
  "/snapshot",
  openApi({
    tags: ["Extract"],
    summary: "Get web snapshot and elements",
    request: {
      json: SnapshotRequestSchema,
    },
    responses: {
      200: { schema: z.null(), mediaType: "text/event-stream" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const { url, width, height, isFullPage, actions } = body;

    return streamSSE(c, async (s) => {
      let page: Page | null = null;

      try {
        page = await newBrowserPage();

        const pageSize = {
          width: Number(width) || 1280,
          height: Number(height) || 800,
        };

        await page.setViewport(pageSize);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        const sendScreenshot = async (quality = 20, fullPage = false) => {
          if (!page) return;

          const fullPageSize = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
          }));
          pageSize.height = Math.min(
            fullPageSize.height,
            pageSize.height,
            2400,
          );

          if (fullPage) {
            await page.evaluate(() => window.scrollTo(0, 0));
            pageSize.height = fullPageSize.height;
          }

          const screenshot = await page.screenshot({
            encoding: "base64",
            type: "jpeg",
            quality,
            fullPage,
          });

          await s.writeSSE({
            event: "screenshot",
            data: JSON.stringify({
              img: screenshot,
              width: pageSize.width,
              height: pageSize.height,
            }),
          });
        };

        let ssInterval: NodeJS.Timeout | null = null;

        if (actions) {
          await sendScreenshot();

          ssInterval = setInterval(() => sendScreenshot(), 250);
          const acts = ActionSchema.array().parse(actions);
          await execActions(page, acts);
        }

        ssInterval && clearInterval(ssInterval);
        await sendScreenshot(70, isFullPage);

        // Extract element tree for selector building
        const elements = await page.evaluate(
          extractElements,
          body.ignoreDuplicates,
        );
        const html = await page.evaluate(getCleanHTML);
        const contentSelector = findContentSelector(html)?.selector || null;

        s.writeSSE({
          event: "result",
          data: JSON.stringify({
            elements,
            url,
            pageSize,
            html,
            contentSelector,
          }),
        });
      } catch (err) {
        await s.writeSSE({
          event: "error",
          data: JSON.stringify({ message: (err as Error).message }),
        });
      } finally {
        if (page) await page.close();
      }
    });
  },
);

// Extract content from web
router.post(
  "/",
  openApi({
    tags: ["Extract"],
    summary: "Queue extract content from web",
    request: {
      json: ExtractRequestSchema,
    },
    responses: {
      200: ExtractResponseSchema,
    },
  }),
  async (c) => {
    const { chapters, selectors, delayChapter, ...body } = c.req.valid("json");

    const task = addTask(async () => {
      let page;
      const contents: { title: string; data: string }[] = [];
      let cover: {
        fullPath: string;
        filename: string;
        contentType: string;
      } | null = null;

      try {
        if (body.cover) {
          cover = await fetchImage(body.cover, "./img");
        }

        page = await newBrowserPage({ blockResources: true });
        await page.setViewport({ width: 640, height: 480 });

        for (let i = 0; i < chapters.length; i++) {
          const c = chapters[i]!;

          setTask(task.id, {
            progress: (i / chapters.length) * 100,
            data: { title: `Extracting "${c.title}"...` },
          });

          const { chapter, content } = await extractContent(
            page,
            c.url,
            selectors,
          );

          if (!content) {
            throw new Error("Cannot extract " + c.title);
          }

          contents.push({
            title: chapter || c.title,
            data: content,
          });

          setTask(task.id, {
            progress: (i / chapters.length) * 100,
            data: { title: `Extracted "${c.title}".` },
          });
          await waitFor((delayChapter || 3) * 1000);
        }

        setTask(task.id, {
          progress: 100,
          data: { title: "Generating EPUB..." },
        });

        await new Epub({
          title: body.title,
          author: body.author,
          cover: cover?.fullPath,
          content: contents,
          output: path.join(
            process.env.DATA_PATH || "./data",
            body.title + ".epub",
          ),
        }).promise;

        setTask(task.id, {
          progress: 100,
          data: { title: "Success!" },
        });

        setTimeout(() => rescanLibrary, 1000);
      } catch (err) {
        console.error(err);
        setTask(task.id, {
          progress: -1,
          data: { title: `Error! ${(err as Error).message}` },
        });
        throw err;
      } finally {
        if (page) await page.close();
        if (cover) await fs.unlink(cover.fullPath);
      }
    });

    return c.var.res({ taskId: task.id });
  },
);

router.get(
  "/tasks",
  openApi({
    tags: ["Extract"],
    summary: "Get extract tasks",
    responses: {
      200: { schema: z.null(), mediaType: "text/event-stream" },
    },
  }),
  async (c) => {
    return streamSSE(c, async (s) => {
      const signal = c.req.raw.signal;

      const sendTasks = async () => {
        s.writeSSE({ event: "tasks", data: JSON.stringify(getTasks()) });
      };

      await sendTasks();
      taskEvents.on("change", sendTasks);

      while (!signal.aborted) {
        await s.writeSSE({
          event: "ping",
          data: JSON.stringify({ date: Date.now() }),
        });

        await waitFor(10000);
      }

      taskEvents.off("change", sendTasks);
    });
  },
);

// Translate content
router.post(
  "/translate",
  openApi({
    tags: ["Extract"],
    summary: "Translate content",
    request: {
      json: TranslateRequestSchema,
    },
    responses: {
      200: TranslateResponseSchema,
    },
  }),
  async (c) => {
    const { text, to = "en" } = c.req.valid("json");
    if (!text) {
      throw new HTTPException(400, { message: "text is required" });
    }

    const result = await translate(text, to);
    return c.json({ result });
  },
);

export default router;

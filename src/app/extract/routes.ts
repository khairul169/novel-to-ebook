import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cleanHTML, translate } from "../../lib/utils";
import * as cheerio from "cheerio";
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
import { extractElements, getCleanHTML } from "./utils";

const routes = new Hono();

// Get web snapshot and elements
routes.post(
  "/snapshot",
  openApi({
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
          body.anchorTextContains,
          body.ignoreDuplicates,
        );
        const html = await page.evaluate(getCleanHTML);

        s.writeSSE({
          event: "result",
          data: JSON.stringify({ elements, url, pageSize, html }),
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
routes.post(
  "/",
  openApi({
    tags: ["Extract"],
    responses: {
      200: ExtractResponseSchema,
    },
    request: {
      json: ExtractRequestSchema,
    },
  }),
  async (c) => {
    const { url, selectors } = c.req.valid("json");

    let page;
    try {
      page = await newBrowserPage({ blockResources: true });

      await page.setViewport({ width: 640, height: 480 });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      const html = await page.evaluate(() => {
        return document.body.outerHTML.trim();
      });
      const $ = cheerio.load(html);
      const chapter = selectors.chapter
        ? $(selectors.chapter)
            .filter((_, i) => $(i).text().trim().length > 0)
            .first()
            .text()
            .trim()
        : null;
      const content = cleanHTML($(selectors.content).html() || "");
      return c.var.res({ chapter, content, url, selectors });
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      if (page) await page.close();
    }
  },
);

// Translate content
routes.post(
  "/translate",
  openApi({
    tags: ["Extract"],
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

export default routes;

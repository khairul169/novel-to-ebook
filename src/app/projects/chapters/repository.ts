import type { Page } from "puppeteer";
import {
  getProjectConfig,
  tryExtractContent,
  updateProjectConfig,
} from "../utils";
import { newBrowserPage } from "../../../lib/browser";
import db from "../../../db";
import { uuid, waitFor } from "../../../lib/utils";
import { importQueue } from "./context";

export function queueImportChapters(payload: {
  projectId: string;
  links: { url: string; title: string }[];
  delayMs?: number;
}) {
  const { projectId, links } = payload;

  return importQueue.add(
    async (ctx) => {
      let page: Page | null = null;
      let fontDecryptMap = projectId
        ? await getProjectConfig(projectId).then((i) => i.fontDecryptMap)
        : null;
      let progress = 0;

      try {
        page = await newBrowserPage();
        await page.setViewport({ width: 640, height: 480 });

        for (const { url, title } of links) {
          ctx.setProgress(
            (progress / links.length) * 100,
            `Extracting ${title}...`,
          );

          const res = await tryExtractContent(page, url, { fontDecryptMap });

          await db
            .insertInto("project_chapters")
            .values({
              id: uuid(),
              projectId,
              index: 0,
              title,
              content: res.content,
            })
            .execute();

          if (res.hasNewDecryptMap) {
            fontDecryptMap = res.fontDecryptMap;
            await updateProjectConfig(projectId, { fontDecryptMap });
          }

          ctx.setProgress((progress++ / links.length) * 100);

          if (payload.delayMs) {
            await waitFor(payload.delayMs);
          }
        }

        console.log("Done");
      } catch (err) {
        console.error(err);
        throw err;
      } finally {
        if (page) await page.close();
      }

      ctx.setProgress(100, "Done");
    },
    { namespace: projectId },
  );
}

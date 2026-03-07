import {
  Browser,
  DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  ElementHandle,
  Page,
} from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import BlockResourcesPlugin from "puppeteer-extra-plugin-block-resources";
import { waitFor } from "./utils";
import { type Action, type ActionWithLoopUntil } from "./schema";

let browser: Browser | null = null;
const blockResources = BlockResourcesPlugin({
  blockedTypes: new Set([
    "image",
    "stylesheet",
    "media",
    "font",
    "manifest",
    "other",
  ]),
  interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
});

export async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.use(StealthPlugin()).launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });
  }
  return browser;
}

export async function newBrowserPage(opt?: { blockResources?: boolean }) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  if (opt?.blockResources) {
    blockResources.onPageCreated(page);
  }

  return page;
}

async function loopUntil(
  page: Page,
  action: ActionWithLoopUntil,
  fn: () => Promise<void>,
) {
  const { loopUntil } = action;
  if (!loopUntil) {
    return await fn();
  }

  let attempts = 0;
  const maxAttempts = loopUntil.attempts || 3;
  let success = false;

  while (attempts < maxAttempts && !success) {
    attempts++;

    await fn();

    if (loopUntil.delay) {
      await waitFor(loopUntil.delay);
    }

    if (loopUntil.repeat) {
      if (attempts >= maxAttempts) {
        success = true;
      }
    }

    if (loopUntil.visible != null) {
      let res: ElementHandle<Element> | null = null;

      try {
        res = await page.waitForSelector(loopUntil.selector, {
          visible: loopUntil.visible,
          timeout: loopUntil.timeout,
        });
      } catch (err) {}

      if (res) {
        success = true;
      }
    }
  }

  if (!success) {
    throw new Error("Failed to execute loop until action");
  }
}

export async function execActions(page: Page, actions: Action[]) {
  for (const action of actions) {
    const { type, data } = action;

    if (type === "click") {
      await loopUntil(page, action, async () => {
        await page.evaluate(
          (sel) => (document.querySelector(sel) as HTMLAnchorElement)?.click(),
          data.selector,
        );
        if (data.waitFor) await waitFor(data.waitFor);
      });
    }

    if (type === "scroll") {
      await loopUntil(page, action, async () => {
        return page.evaluate(
          (data) => window.scrollTo(data.x || 0, data.y || 0),
          data,
        );
      });
    }

    if (type === "wait") {
      switch (data.until) {
        case "timeout":
          await waitFor(data.ms || 1000);
          break;

        case "domcontentloaded":
        case "networkidle0":
        case "networkidle2":
          await page.waitForNavigation({
            waitUntil: data.until,
            timeout: data.timeout || 30000,
          });
          break;

        case "selector":
          if (!data.selector) {
            throw new Error("selector is required");
          }
          await page.waitForSelector(data.selector, {
            timeout: data.timeout || 30000,
            visible: data.visible,
          });
          break;

        default:
          throw new Error(`Unknown wait until: ${data.until}`);
      }
    }

    if (type === "input") {
      await page.type(data.selector, data.text);
    }
  }
}

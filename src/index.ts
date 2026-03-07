import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import BlockResourcesPlugin from "puppeteer-extra-plugin-block-resources";
import { cleanHTML } from "./utils";
import * as cheerio from "cheerio";

const app = new Hono();

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

async function getBrowser() {
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

app.post("/screenshot", async (c) => {
  const {
    url,
    width,
    height,
    scrollY,
    isFullPage = false,
  } = await c.req.json();
  if (!url) {
    return c.json({ error: "url is required" }, 400);
  }

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    const pageSize = {
      width: Number(width) || 1280,
      height: Number(height) || 800,
    };

    await page.setViewport(pageSize);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const fullPageSize = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));

    pageSize.height = Math.min(fullPageSize.height, pageSize.height, 2400);
    // await page.setViewport(pageSize);

    if (isFullPage) {
      pageSize.height = fullPageSize.height;
    }

    if (scrollY) {
      await page.evaluate((scrollY) => {
        window.scrollTo(0, scrollY);
      }, scrollY);
    }

    const screenshot = await page.screenshot({
      encoding: "base64",
      type: "jpeg",
      quality: 70,
      fullPage: pageSize.height >= fullPageSize.height,
    });

    // Extract element tree for selector building
    const elements = await page.evaluate(() => {
      const result: any[] = [];
      const seen = new Set();

      function getElementsWithText(text: string) {
        return Array.from(document.querySelectorAll("*")).filter((el) => {
          const isMatch =
            el.textContent.trim() === text.trim() && el.textContent.length < 30;
          if (!isMatch) return false;

          const hasChildMatch = Array.from(el.children).some(
            (child) => child.textContent.trim() === text.trim(),
          );
          return !hasChildMatch;
        });
      }

      function getSelector(el: HTMLElement) {
        const parts = [];
        let current: HTMLElement | null = el;

        if (
          current.tagName.toLowerCase() === "a" &&
          current instanceof HTMLAnchorElement &&
          current.href &&
          current.textContent.length > 0 &&
          current.textContent.length < 30 &&
          getElementsWithText(current.textContent).length === 1
        ) {
          return `${current.tagName.toLowerCase()}:contains("${current.textContent.trim()}")`;
        }

        let depth = 0;
        while (current && current !== document.body && depth < 10) {
          depth++;
          let seg = current.tagName.toLowerCase();
          if (current.id) {
            seg += `#${current.id}`;
            parts.unshift(seg);
            break;
          }
          const classes = Array.from(current.classList)
            .filter((c) => {
              return !c.match(/^\d/) && c.length < 24 && !c.match(/\d{6,}/);
            })
            .slice(0, 2)
            .join(".");
          if (classes) seg += `.${classes}`;
          const siblings = current.parentElement
            ? Array.from(current.parentElement.children).filter(
                (c) =>
                  c.tagName === current?.tagName &&
                  (!current.classList.length ||
                    c.classList.contains(current.classList[0]!)),
              )
            : [];
          if (siblings.length > 1 && parts.length === 0) {
            seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          parts.unshift(seg);
          current = current.parentElement;
        }

        return parts.join(" > ");
      }

      const tags = [
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "b",
        "strong",
        "em",
        "i",
        "u",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "td",
        "th",
        "div",
        "section",
        "article",
        "header",
        "footer",
        "nav",
        "main",
        "aside",
        "button",
        // "input",
        // "form",
        "span",
        "figure",
        "blockquote",
      ];

      for (const tag of tags) {
        document.querySelectorAll(tag).forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) return;
          const selector = getSelector(el);
          if (seen.has(selector)) return;
          seen.add(selector);

          // exclude if parent tags is not in the list of allowed tags
          let parent = el.parentElement;
          let depth = 0;
          while (parent && parent !== document.body && depth < 3) {
            if (!tags.includes(parent.tagName.toLowerCase())) return;
            parent = parent.parentElement;
            depth += 1;
          }

          // exclude if element is hidden or not visible
          const style = window.getComputedStyle(el);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) < 0.01
          )
            return;

          const text =
            el.innerText?.trim().slice(0, 80) ||
            el.getAttribute("alt") ||
            el.getAttribute("src") ||
            "";

          result.push({
            tag: el.tagName.toLowerCase(),
            selector,
            text,
            box: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            },
            attrs: {
              id: el.id || undefined,
              class: el.className?.slice?.(0, 60) || undefined,
              href: el.href || undefined,
              src: el.src || undefined,
            },
          });
        });
      }

      return result;
    });

    const html = await page.evaluate(() => {
      const tagsToRemove = [
        "script",
        "style",
        "svg",
        "noscript",
        "iframe",
        // "img",
        "video",
      ];
      tagsToRemove.forEach((tag) => {
        document.querySelectorAll(tag).forEach((el) => el.remove());
      });

      const allowedAttributes = [
        "id",
        "class",
        "itemprop",
        "href",
        "src",
        "alt",
        "title",
        "role",
        "rel",
      ];

      document.body.querySelectorAll("*").forEach((el) => {
        // Remove unnecessary attributes
        Array.from(el.attributes).forEach((attr) => {
          if (!allowedAttributes.includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        });

        // if (el.children.length === 0 && el.textContent.trim().length > 96) {
        //   //  if (keyword && el.textContent.includes(keyword)) {
        //   //      el.textContent = `[TARGET MATCH: ${el.textContent.substring(0, 50)}...]`;
        //   //  } else {
        //   el.textContent = el.textContent.substring(0, 96) + "...";
        //   //  }
        // }
      });

      return document.body.outerHTML
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();
    });

    return c.json({ screenshot, elements, url, pageSize, html });
  } catch (err) {
    console.error(err);
    return c.json({ error: (err as Error).message }, 500);
  } finally {
    if (page) await page.close();
  }
});

app.post("/extract", async (c) => {
  const { url, selectors } = await c.req.json();
  // if (!Array.isArray(chapters) || !chapters.length) {
  //   return c.json({ error: "chapters is required" }, 400);
  // }
  if (!url) {
    return c.json({ error: "url is required" }, 400);
  }
  if (!selectors) {
    return c.json({ error: "selectors is required" }, 400);
  }

  // const promises = chapters.map(async (chapter, idx) => {
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    blockResources.onPageCreated(page);

    await page.setViewport({ width: 640, height: 480 });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const html = await page.evaluate(() => {
      return document.body.outerHTML.trim();
    });
    const $ = cheerio.load(html);
    const chapter = $(selectors.chapter).first().text().trim();
    const content = cleanHTML($(selectors.content).html() || "");
    return c.json({ chapter, content, url, selectors: selectors as any });
  } catch (err) {
    console.error(err);
    return c.json({ error: (err as Error).message });
  } finally {
    if (page) await page.close();
  }
});

app.get("/proxy/*", async (c) => {
  const url = new URL(c.req.url);
  const target = url.pathname.replace("/proxy/", "");
  return proxy(target);
});

Bun.serve({
  fetch: app.fetch,
  idleTimeout: 255,
});

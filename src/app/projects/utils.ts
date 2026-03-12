import { Page } from "puppeteer";
import * as cheerio from "cheerio";
import { cleanHTML } from "../../lib/utils";
import fs from "fs/promises";
import path from "path";
import { JSDOM } from "jsdom";

export function extractElements(ignoreDuplicates = false) {
  const result: any[] = [];
  const seen = new Set();

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
    "input",
    // "form",
    "span",
    "figure",
    "blockquote",
    "select",
  ];

  function getSelector(el: HTMLElement, doc: Document) {
    const parts = [];
    let current: HTMLElement | null = el;

    let depth = 0;
    while (current && current !== doc.body && depth < 10) {
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

    // return parts.join(" > ");
    return parts.join(" ");
  }

  for (const tag of tags) {
    document.querySelectorAll(tag).forEach((el: any) => {
      const rect = el.getBoundingClientRect();
      // if (rect.width < 5 || rect.height < 5) return;
      const selector = getSelector(el, document);

      if (ignoreDuplicates) {
        if (seen.has(selector)) return;
        seen.add(selector);
      }

      // exclude if parent tags is not in the list of allowed tags
      // let parent = el.parentElement;
      // let depth = 0;
      // while (parent && parent !== document.body && depth < 3) {
      //   if (!tags.includes(parent.tagName.toLowerCase())) return;
      //   parent = parent.parentElement;
      //   depth += 1;
      // }

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
}

export function getCleanHTML() {
  const tagsToRemove = [
    "script",
    "style",
    "svg",
    "noscript",
    "iframe",
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

  // Remove unnecessary attributes
  document.body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (!allowedAttributes.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return document.body.outerHTML
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

export async function extractContent(page: Page, url: string, selectors: any) {
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
  const content = cleanHTML($(selectors.content).html() || "").replace(
    /src="\/\//g,
    'src="https://',
  );
  return { chapter, content, url, selectors };
}

export async function fetchImage(url: string, outDir: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.statusText}`);
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.split("/")[1] || "";
  if (!["jpeg", "jpg", "png", "svg", "webp", "gif", "bmp"].includes(ext)) {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  const urlParts = new URL(url);
  const filename =
    (urlParts.pathname.split("/").pop() || "image-" + Date.now()) + "." + ext;
  const fullPath = path.join(outDir, filename);
  await fs.writeFile(fullPath, Buffer.from(buffer));

  return { fullPath, filename, contentType };
}

export function getSelector(el: HTMLElement, doc: Document) {
  const parts = [];
  let current: HTMLElement | null = el;

  let depth = 0;
  while (current && current !== doc.body && depth < 10) {
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

  // return parts.join(" > ");
  return parts.join(" ");
}

export function findContentSelector(html: string) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const scores = new Map<HTMLElement, number>();

  const paragraphs = doc.querySelectorAll("p");

  for (const p of paragraphs) {
    const text = p.textContent?.trim() ?? "";
    if (text.length < 40) continue;

    const parent = p.parentElement;
    if (!parent) continue;

    const grand = parent.parentElement;
    let score = 1 + Math.min(Math.floor(text.length / 120), 3);
    scores.set(parent, (scores.get(parent) || 0) + score);

    if (grand) {
      scores.set(grand, (scores.get(grand) || 0) + score * 0.5);
    }
    if (parent.children.length > 3) {
      scores.set(parent, (scores.get(parent) || 0) + 2);
    }
  }

  // images
  const images = doc.querySelectorAll("img");
  for (const img of images) {
    const parent = img.parentElement;
    if (!parent) continue;

    const grand = parent.parentElement;
    let score = 2;
    scores.set(parent, (scores.get(parent) || 0) + score);

    if (grand) {
      scores.set(grand, (scores.get(grand) || 0) + score * 0.5);
    }
    if (parent.children.length <= 3) {
      scores.set(parent, (scores.get(parent) || 0) + 3);
    }
  }

  // best element
  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const [el, score] of scores) {
    const textLength = el.textContent?.trim()?.length ?? 1;
    const linkCount = el.querySelectorAll("a").length;
    const linkDensity = linkCount / textLength;
    const finalScore = score - linkDensity * 10;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = el;
    }
  }

  if (!best) return null;

  // Find chapter title
  let title = "";
  let titleSelector: string | null = "";

  const titleEl = [
    ...best.querySelectorAll("h1, h2, h3, h4, b, strong, p:first-of-type"),
  ].filter((el) => el.textContent?.trim().length)[0];

  if (titleEl) {
    title = titleEl.textContent?.trim() || "";
    titleSelector = getSelector(titleEl as HTMLElement, doc);
  }

  return {
    selector: getSelector(best, doc),
    element: best,
    html: best.innerHTML.trim(),
    title,
    titleSelector,
  };
}

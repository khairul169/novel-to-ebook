import * as cheerio from "cheerio";
import Epub from "epub-gen";
import { cleanHTML, generateSelectors } from "./utils";
import type { Selector } from "./schema";
import { getSelector, loadSelectors, saveSelector } from "./consts";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";

async function main() {
  await loadSelectors();

  const browser = await puppeteer
    .use(StealthPlugin())
    .launch({ headless: true });
  const page = await browser.newPage();

  //   let url = new URL(
  //     "https://neosekaitranslations.com/novel/i-became-friends-with-the-second-cutest-girl-in-my-class/ln-vol-2-illust/",
  //   );
  let url = new URL(
    "https://www.webnovel.com/book/29021893400828005/78221233556091847",
  );
  const maxChapters = 100;
  const domain = url.hostname;
  //   let html = await fetch(url).then((i) => i.text());

  await page.goto(String(url), { waitUntil: "networkidle0" });
  let html = await page.content();

  let selector: Selector | undefined = getSelector(domain);
  let nextChapterUrl: string | undefined | false;
  let hasRetriedGeneratingSelector = false;

  if (!selector) {
    console.log("Generating selector...");
    selector = await generateSelectors(html);
    console.log("Selector generated!", selector);
    await saveSelector(domain, selector);
  }
  if (!selector) {
    throw new Error("No selector");
  }

  let title = "";
  const chapters: Epub.Chapter[] = [];
  const dt = Date.now();

  while (nextChapterUrl !== false) {
    if (nextChapterUrl) {
      url = new URL(nextChapterUrl, url);
      //   html = await fetch(url).then((i) => i.text());

      await page.goto(String(url), { waitUntil: "networkidle0" });
      html = await page.content();
    }

    console.log(`Fetching ${url}`);

    const $ = cheerio.load(html);
    title = $(selector.title).text().trim();

    if (!title && !hasRetriedGeneratingSelector) {
      console.log(
        `Failed to extract title using "${selector.title}" selector. Retrying...`,
      );
      hasRetriedGeneratingSelector = true;

      const followUp = await generateSelectors(
        html,
        `Failed to extract title using "${selector.title}" selector. Please provide the correct selector.`,
      );
      console.log("Follow up selectors:", followUp);

      title = $(followUp.title).text().trim();
      if (!title) {
        throw new Error("No title");
      }
      selector = await saveSelector(domain, selector);
    }

    if (!title) {
      throw new Error("No title");
    }

    let chapter = selector.chapter ? $(selector.chapter).text().trim() : "";
    if (!selector.chapter && selector.isChapterInTitle) {
      const tc = title.split(selector.titleSeparator?.trim() || "-");
      title = tc[0]?.trim() || title;
      chapter = tc[1]?.trim() || "";
    }
    chapter = chapter || "Unknown";

    console.log(`Fetched ${title} - ${chapter}!`);

    let content = $(selector.content).html()?.trim();
    if (!content) {
      throw new Error("No content");
    }

    if (selector.urls?.nextChapter) {
      nextChapterUrl = $(selector.urls.nextChapter).attr("href")?.trim();
      if (!nextChapterUrl?.startsWith("http")) {
        break;
      }
    } else {
      nextChapterUrl = false;
    }

    // Sanitize content
    content = cleanHTML(content);

    chapters.push({
      title: chapter,
      data: content,
    });

    await fs.mkdir(`./data/source`, { recursive: true });
    await fs.writeFile(
      `./data/source/${dt} - ${title}.json`,
      JSON.stringify({ title, chapters }, null, 2),
    );

    if (chapters.length >= maxChapters) {
      break;
    }
  }

  const epub = new Epub({
    title,
    author: domain,
    output: `./data/${title}.epub`,
    content: chapters,
  });

  await epub.promise;
  console.log(`Done extracting ${title}!`);

  await browser.close();
}

main();

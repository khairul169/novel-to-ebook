import sanitizeHtml from "sanitize-html";
import { GoogleGenAI } from "@google/genai";
import { selectorExample, SelectorSchema } from "./schema";
import removeMd from "remove-markdown";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});

export async function generateSelectors(html: string, followUp?: string) {
  const prompts = [
    {
      role: "user",
      text:
        "You're a very good web scraper. Generate html selector to extract novel title, chapter, & content from html using cheerio.\n" +
        "The web maybe have anti scrape such as random classname, so find the best selector. If classname is random like `a.mb0` or `.cl54`, use the element itself. " +
        "If the element is div/span and have classname, dont specify the element, just the class itself, like `div.cha-title` -> `.cha-title`. " +
        "If the title contain chapter number, set `isChapterInTitle` to true and fill out `titleSeparator`, like '-'. If there are prev/next chapter links, fill out `urls`.\n" +
        "Output only as JSON, no other text.\n" +
        "Example output: \n" +
        JSON.stringify(selectorExample) +
        "\n\nNow Start:\n" +
        html,
    },
  ];

  if (followUp) {
    prompts.push({
      role: "user",
      text: followUp,
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompts,
  });
  if (!response.text) {
    throw new Error("No response");
  }

  const res = JSON.parse(removeMd(response.text));
  return SelectorSchema.parse(res);
}

export function cleanHTML(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "span",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "img",
    ],

    allowedAttributes: {
      img: ["src", "alt", "title", "width", "height"],
      p: ["style"],
      span: ["style"],
    },

    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
  }).trim();
}

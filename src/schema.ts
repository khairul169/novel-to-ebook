import { z } from "zod";

export const SelectorSchema = z.object({
  title: z.string().min(1),
  chapter: z.string().nullish(),
  isChapterInTitle: z.boolean().nullish(),
  titleSeparator: z.string().nullish(),
  content: z.string().min(1),
  urls: z
    .object({
      nextChapter: z.string().nullish(),
      prevChapter: z.string().nullish(),
    })
    .nullish(),
});

export type Selector = z.infer<typeof SelectorSchema>;

export const selectorExample: Selector = {
  title: "h1.title",
  chapter: "h2.chapter",
  isChapterInTitle: true,
  titleSeparator: "-",
  content: "div.reading-content",
  urls: {
    nextChapter: null,
    prevChapter: "a.prev-chapter",
  },
};

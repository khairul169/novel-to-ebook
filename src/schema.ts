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

export const LoopUntilSchema = z.object({
  repeat: z.boolean().nullish(),
  visible: z.boolean().nullish(),
  selector: z.string(),
  timeout: z.number().optional(),
  attempts: z.number().optional(),
  delay: z.number().optional(),
});

const actionWithLoopUntil = z.object({
  loopUntil: LoopUntilSchema.nullish(),
});

export type ActionWithLoopUntil = z.infer<typeof actionWithLoopUntil>;

export const ClickActionSchema = actionWithLoopUntil.extend({
  type: z.literal("click"),
  data: z.object({
    selector: z.string().min(1),
    waitFor: z.number().optional(),
  }),
});

export const ScrollActionSchema = actionWithLoopUntil.extend({
  type: z.literal("scroll"),
  data: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
  }),
});

export const WaitActionSchema = z.object({
  type: z.literal("wait"),
  data: z.object({
    until: z
      .enum([
        "timeout",
        "domcontentloaded",
        "networkidle0",
        "networkidle2",
        "selector",
      ])
      .optional(),
    ms: z.number().optional(),
    selector: z.string().optional(),
    visible: z.boolean().optional(),
    timeout: z.number().optional(),
  }),
});

export const InputActionSchema = z.object({
  type: z.literal("input"),
  data: z.object({
    selector: z.string(),
    text: z.string(),
  }),
});

export const ActionSchema = z.union([
  ClickActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  InputActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;

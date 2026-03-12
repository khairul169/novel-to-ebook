import z from "zod";

export const projectDetailsSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  cover: z.string(),
  language: z.string(),
});

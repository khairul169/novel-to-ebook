import { z } from "zod";

export const ChapterSchema = z.object({
  id: z.number(),
  projectId: z.uuid(),
  title: z.string(),
  content: z.string(),
  index: z.number(),
});

export const CreateChapterSchema = ChapterSchema.pick({
  title: true,
  content: true,
  index: true,
});

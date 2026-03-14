import z from "zod";

export const LibraryItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  path: z.string(),
  fullPath: z.string(),
  parent: z.string(),
  cover: z.string().nullish(),
  coverHash: z.string().nullish(),
  isDirectory: z.boolean(),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .meta({
      example: {
        title: "Your title here",
        creator: "Hingle McCringleberry",
        creatorFileAs: "Hingle McCringleberry",
        language: "en",
        role: "aut",
        "dcterms:modified": "2011-01-01T12:00:00Z",
        cover: "cover.jpg",
      },
    }),
});

export const ListLibraryResponseSchema = z.array(LibraryItemSchema);

export const GetLibraryRequestSchema = z.object({
  key: z.string(),
});

export const GetLibraryResponseSchema = z.any();

export const GetCoverRequestSchema = z.object({
  key: z.string(),
});

export const GetCoverResponseSchema = z.any();

import { Hono } from "hono";
import { openApi } from "hono-zod-openapi";
import {
  ListLibraryResponseSchema,
  GetLibraryRequestSchema,
  GetLibraryResponseSchema,
  GetCoverRequestSchema,
  GetCoverResponseSchema,
} from "./schema";
import { HTTPError } from "../../lib/error";
import fs from "fs/promises";
import { getLibrary } from "./context";

const router = new Hono();

router.get(
  "/",
  openApi({
    tags: ["Library"],
    summary: "List library",
    responses: { 200: ListLibraryResponseSchema },
  }),
  async (c) => {
    return c.var.res(getLibrary());
  },
);

router.get(
  "/get",
  openApi({
    tags: ["Library"],
    summary: "Get library file",
    request: { query: GetLibraryRequestSchema },
    responses: {
      200: {
        schema: GetLibraryResponseSchema,
        mediaType: "application/epub+zip",
      },
    },
  }),
  async (c) => {
    const { key } = c.req.valid("query");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    const file = await fs.readFile(item.fullPath);

    return c.body(file, 200, {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${item.name}.epub"`,
    });
  },
);

router.get(
  "/cover.jpeg",
  openApi({
    tags: ["Library"],
    summary: "Get library cover",
    request: { query: GetCoverRequestSchema },
    responses: {
      200: { schema: GetCoverResponseSchema, mediaType: "image/jpeg" },
    },
  }),
  async (c) => {
    const { key } = c.req.valid("query");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    const cover = item.getCover ? await item.getCover() : null;
    if (!cover?.data || !cover.data?.length) {
      throw new HTTPError("Cover not found", { status: 404 });
    }

    return c.body(Buffer.from(cover.data), 200, {
      "Content-Type": cover.mimeType,
    });
  },
);

export default router;

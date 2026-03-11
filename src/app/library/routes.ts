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
import z from "zod";
import db from "../../db";
import { sql } from "kysely";

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

router.get(
  "/history",
  openApi({
    responses: {
      200: z
        .object({
          key: z.string(),
          fraction: z.number(),
          date: z.iso.date(),
        })
        .array(),
    },
  }),
  async (c) => {
    const libraries = getLibrary();
    const res = await db
      .selectFrom("read_history")
      .selectAll()
      .limit(10)
      .orderBy("updatedAt", "desc")
      .execute();

    const items = res
      .map((i) => ({
        key: i.key,
        fraction: Number(i.fraction),
        date: i.updatedAt,
        metadata: libraries.find((l) => l.key === i.key && !l.isDirectory)
          ?.metadata,
      }))
      .filter((i) => !!i.metadata);

    return c.var.res(items);
  },
);

router.get(
  "/progress",
  openApi({
    request: {
      query: z.object({ key: z.string().min(1) }),
    },
    responses: {
      200: z.object({
        fraction: z.number(),
        location: z.any(),
        date: z.iso.date(),
      }),
    },
  }),
  async (c) => {
    const { key } = c.req.valid("query");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    const progress = await db
      .selectFrom("read_history")
      .selectAll()
      .where("key", "=", key)
      .limit(1)
      .orderBy("createdAt", "desc")
      .executeTakeFirstOrThrow();

    return c.var.res({
      fraction: Number(progress.fraction),
      date: progress.updatedAt,
      location: JSON.parse(progress.location),
    });
  },
);

router.put(
  "/progress",
  openApi({
    request: {
      json: z.object({
        key: z.string().min(1),
        fraction: z.number(),
        location: z.any(),
      }),
    },
    responses: {
      204: { description: "No content" },
    },
  }),
  async (c) => {
    const { key, fraction, location } = c.req.valid("json");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    await db
      .insertInto("read_history")
      .values({
        key,
        fraction: String(fraction),
        location: JSON.stringify(location),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          fraction: String(fraction),
          location: JSON.stringify(location),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        }),
      )
      .execute();

    return c.body(null, 204);
  },
);

export default router;

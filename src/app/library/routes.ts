import { Hono } from "hono";
import { openApi } from "hono-zod-openapi";
import {
  ListLibraryResponseSchema,
  GetLibraryRequestSchema,
  GetLibraryResponseSchema,
  GetCoverRequestSchema,
  GetCoverResponseSchema,
  LibraryItemSchema,
} from "./schema";
import { HTTPError } from "../../lib/error";
import { getLibrary } from "./context";
import z from "zod";
import db from "../../db";

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
  "/detail",
  openApi({
    tags: ["Library"],
    summary: "Get item detail",
    request: { query: GetLibraryRequestSchema },
    responses: {
      200: LibraryItemSchema,
    },
  }),
  async (c) => {
    const { key } = c.req.valid("query");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    return c.var.res(item);
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

    const file = Bun.file(item.fullPath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${item.name}"`,
      },
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
          name: z.string(),
          date: z.iso.date(),
          location: z.any(),
          metadata: z.any().nullish(),
          cover: z.string().nullish(),
        })
        .array(),
    },
  }),
  async (c) => {
    const libraries = getLibrary();
    const res = await db
      .selectFrom("histories")
      .selectAll()
      .limit(10)
      .orderBy("date", "desc")
      .execute();

    const items = res
      .map((i) => {
        const libItem = libraries.find(
          (l) => l.key === i.key && !l.isDirectory,
        );
        return {
          key: i.key,
          name: i.key.split("/").pop()?.split(".").slice(0, -1).join(".") || "",
          date: i.date,
          metadata: libItem?.metadata,
          cover: libItem?.cover,
          location: JSON.parse(i.location),
        };
      })
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
      .selectFrom("histories")
      .selectAll()
      .where("key", "=", key)
      .limit(1)
      .orderBy("date", "desc")
      .executeTakeFirstOrThrow();

    return c.var.res({
      date: progress.date,
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
        location: z.any(),
        date: z.iso.datetime(),
      }),
    },
    responses: {
      204: { description: "No content" },
    },
  }),
  async (c) => {
    const { key, location, date } = c.req.valid("json");
    const item = getLibrary().find((i) => i.key === key && !i.isDirectory);
    if (!item) {
      throw new HTTPError("Library item not found", { status: 404 });
    }

    await db
      .insertInto("histories")
      .values({
        key,
        location: JSON.stringify(location),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          location: JSON.stringify(location),
          date,
        }),
      )
      .execute();

    return c.body(null, 204);
  },
);

export default router;

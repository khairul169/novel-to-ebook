import { Hono } from "hono";
import { openApi } from "hono-zod-openapi";
import { ChapterSchema, CreateChapterSchema } from "./schema";
import db from "../../../db";
import { uuid } from "../../../lib/utils";
import z from "zod";

const router = new Hono();

// Create new chapter
router.post(
  "/",
  openApi({
    tags: ["Projects"],
    summary: "Create new chapter",
    request: {
      param: z.object({ projectId: z.string() }),
      json: CreateChapterSchema,
    },
    responses: { 200: ChapterSchema.pick({ id: true }) },
  }),
  async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const res = await db
      .insertInto("project_chapters")
      .values({ ...body, id: uuid(), projectId })
      .returning("id")
      .executeTakeFirstOrThrow();

    return c.var.res(res);
  },
);

// List chapters
router.get(
  "/",
  openApi({
    tags: ["Projects"],
    summary: "List chapters",
    request: {
      param: z.object({ projectId: z.string() }),
    },
    responses: { 200: z.array(ChapterSchema) },
  }),
  async (c) => {
    const { projectId } = c.req.valid("param");
    const res = await db
      .selectFrom("project_chapters")
      .selectAll()
      .where("projectId", "=", projectId)
      .orderBy("index", "asc")
      .execute();
    return c.var.res(res);
  },
);

// Get chapter
router.get(
  "/:id",
  openApi({
    tags: ["Projects"],
    summary: "Get chapter by id",
    request: { param: z.object({ projectId: z.string(), id: z.string() }) },
    responses: { 200: ChapterSchema },
  }),
  async (c) => {
    const { projectId, id } = c.req.valid("param");
    const res = await db
      .selectFrom("project_chapters")
      .selectAll()
      .where("projectId", "=", projectId)
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    return c.var.res(res);
  },
);

// Update chapter
router.put(
  "/:id",
  openApi({
    tags: ["Projects"],
    summary: "Update chapter",
    request: {
      param: z.object({ projectId: z.string(), id: z.string() }),
      json: ChapterSchema.partial(),
    },
    responses: { 200: ChapterSchema },
  }),
  async (c) => {
    const { projectId, id } = c.req.valid("param");
    const body = c.req.valid("json");
    const res = await db
      .updateTable("project_chapters")
      .set(body)
      .where("projectId", "=", projectId)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.var.res(res);
  },
);

// Delete chapter
router.delete(
  "/:id",
  openApi({
    tags: ["Projects"],
    summary: "Delete chapter",
    request: { param: z.object({ projectId: z.string(), id: z.string() }) },
    responses: { 204: { description: "No content" } },
  }),
  async (c) => {
    const { projectId, id } = c.req.valid("param");
    await db
      .deleteFrom("project_chapters")
      .where("projectId", "=", projectId)
      .where("id", "=", id)
      .execute();
    return c.body(null, 204);
  },
);

export default router;

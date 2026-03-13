import { sql, type Kysely, type Migration } from "kysely";

export const Migration0001: Migration = {
  async up(db: Kysely<any>) {
    // read history
    await db.schema
      .createTable("histories")
      .addColumn("id", "integer", (cb) =>
        cb.primaryKey().notNull().autoIncrement(),
      )
      .addColumn("key", "text", (cb) => cb.notNull().unique())
      .addColumn("location", "jsonb", (cb) => cb.notNull())
      .addColumn("date", "timestamp", (cb) =>
        cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();

    // projects
    await db.schema
      .createTable("projects")
      .addColumn("id", "text", (cb) => cb.primaryKey().notNull())
      .addColumn("title", "text", (cb) => cb.notNull())
      .addColumn("author", "text", (cb) => cb.notNull())
      .addColumn("cover", "text", (cb) => cb.notNull().defaultTo(""))
      .addColumn("language", "text", (cb) => cb.notNull().defaultTo("en"))
      .addColumn("config", "jsonb")
      .addColumn("createdAt", "timestamp", (cb) =>
        cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn("updatedAt", "timestamp", (cb) =>
        cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();

    // project table of contents
    await db.schema
      .createTable("project_chapters")
      .addColumn("id", "integer", (cb) =>
        cb.primaryKey().notNull().autoIncrement(),
      )
      .addColumn("projectId", "text", (cb) =>
        cb.notNull().references("projects.id").onDelete("cascade"),
      )
      .addColumn("title", "text", (cb) => cb.notNull())
      .addColumn("content", "text", (cb) => cb.notNull())
      .addColumn("index", "integer", (cb) => cb.notNull())
      .execute();
    await db.schema
      .createIndex("project_chapters_index")
      .on("project_chapters")
      .column("index")
      .execute();
  },

  async down(db: Kysely<any>) {
    await db.schema.dropTable("histories").execute();
    await db.schema.dropTable("projects").execute();
    await db.schema.dropTable("project_chapters").execute();
  },
};

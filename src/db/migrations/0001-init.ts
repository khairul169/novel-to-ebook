import { sql, type Kysely, type Migration } from "kysely";

export const Migration0001: Migration = {
  async up(db: Kysely<any>) {
    // read history
    await db.schema
      .createTable("read_history")
      .addColumn("id", "integer", (cb) => cb.primaryKey().autoIncrement())
      .addColumn("key", "text", (cb) => cb.notNull().unique())
      .addColumn("fraction", "double precision", (cb) => cb.notNull())
      .addColumn("location", "jsonb", (cb) => cb.notNull())
      .addColumn("createdAt", "timestamp", (cb) =>
        cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn("updatedAt", "timestamp", (cb) =>
        cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();
  },

  async down(db: Kysely<any>) {
    await db.schema.dropTable("notes").execute();
  },
};

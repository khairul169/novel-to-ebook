import type { DB } from "./types";
import { BunWorkerDialect } from "kysely-bun-worker";
import { Kysely } from "kysely";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  throw new Error("DATABASE_URL is not set");
}

const dialect = new BunWorkerDialect({
  url: DB_URL,
});

const db = new Kysely<DB>({
  dialect,
});

export default db;

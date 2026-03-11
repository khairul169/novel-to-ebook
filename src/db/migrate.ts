import { Migrator } from "kysely";
import db from ".";
import { migrations } from "./migrations";

export async function runMigration() {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return migrations;
      },
    },
  });
  migrator.migrateToLatest();
}

import type { Migration } from "kysely";
import { Migration0001 } from "./0001-init";

export const migrations: Record<string, Migration> = {
  "0001": Migration0001,
};

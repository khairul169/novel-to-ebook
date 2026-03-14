import type { BookRelocate } from "@/app/reader/lib/types";
import { openDB, type DBSchema } from "idb";

export interface Database extends DBSchema {
  queries: { key: string; value: string };
  images: { key: string; value: Blob };
  books: { key: string; value: File };
  histories: {
    key: string;
    value: {
      key: string;
      name: string;
      metadata?: any;
      cover?: string | null;
      location: BookRelocate;
      date: Date;
    };
    indexes: {
      date: Date;
    };
  };
}

export type DBValue<T extends keyof Database> = Database[T]["value"];

export async function getDB() {
  return openDB<Database>("storvi", 1, {
    upgrade(db) {
      db.createObjectStore("queries");
      db.createObjectStore("images");
      db.createObjectStore("books");

      const histories = db.createObjectStore("histories");
      histories.createIndex("date", "date");
    },
  });
}

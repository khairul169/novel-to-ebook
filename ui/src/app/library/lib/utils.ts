import { getDB } from "@/lib/db";

export function getLibraryTitle(opt?: {
  search?: string | null;
  baseDir?: string | null;
}) {
  if (opt?.search) {
    return `Searching for ${opt.search}..`;
  }

  if (opt?.baseDir) {
    return opt.baseDir.split("/").pop();
  }

  return "My Library";
}

export async function getHistories() {
  const tx = await getDB().then((db) =>
    db.transaction("histories", "readonly"),
  );
  const index = tx.store.index("date");

  const results = [];
  let cursor = await index.openCursor(null, "prev");

  while (cursor && results.length < 10) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}

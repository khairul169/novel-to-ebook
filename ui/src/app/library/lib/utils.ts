import api from "@/lib/api";
import { getDB, type DBValue } from "@/lib/db";

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

export async function syncHistories() {
  try {
    const { data } = await api.GET("/library/history");
    const histories = data || [];
    const tx = await getDB().then((db) =>
      db.transaction("histories", "readwrite"),
    );

    for (const history of histories) {
      const exist = await tx.store.get(history.key);
      if (exist && exist.date >= new Date(history.date)) {
        continue;
      }

      const values: DBValue<"histories"> = {
        name: history.name,
        key: history.key,
        cover: history.cover,
        date: new Date(history.date),
        metadata: history.metadata,
        location: history.location as never,
      };

      console.log("values", values);
      await tx.store.put(values, history.key);
    }

    await tx.done;
  } catch (err) {
    console.error("Cannot sync histories!", err);
    throw err;
  }
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

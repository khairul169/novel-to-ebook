import { $api, API_URL } from "@/lib/api";
import type { paths } from "@/lib/api.schema";
import { getDB } from "@/lib/db";
import { useEffect, useState } from "react";

function createApiCacheKey(method: string, path: string, options?: any) {
  return JSON.stringify({
    method,
    path,
    params: options?.params ?? null,
    query: options?.query ?? null,
  });
}

export function useOfflineApiQuery(
  method: "get" | "post" | "put" | "delete" | "patch",
  path: keyof paths,
  options?: any,
) {
  const cacheKey = createApiCacheKey(method, path, options);
  const query = $api.useQuery(method, path as never, options);
  const [cachedData, setCachedData] = useState<any>();

  // load cached data first
  useEffect(() => {
    getDB()
      .then((db) => db.get("queries", cacheKey))
      .then((data) => {
        if (data) setCachedData(data);
      });
  }, [cacheKey]);

  // persist fresh data
  useEffect(() => {
    if (query.data) {
      getDB().then((db) => db.put("queries", query.data, cacheKey));
    }
  }, [query.data, cacheKey]);

  return {
    ...query,
    // fallback to cache
    data: query.data ?? cachedData,
    isOfflineFallback: !query.data && !!cachedData,
  };
}

const imagesCache = new Map<string, string>();

export async function getOfflineImage(url: string) {
  if (imagesCache.has(url)) {
    return imagesCache.get(url)!;
  }

  const db = await getDB();

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("network");

    const blob = await res.blob();
    await db.put("images", blob, url);

    const obj = URL.createObjectURL(blob);
    imagesCache.set(url, obj);

    return obj;
  } catch (e) {
    const cached = await db.get("images", url);
    if (!cached) throw new Error("no cached image");

    const obj = URL.createObjectURL(cached);
    imagesCache.set(url, obj);
    return obj;
  }
}

export async function getBookData(key: string) {
  const db = await getDB();
  const cached = await db.get("books", key);

  try {
    const res = await fetch(API_URL + "/library/get?key=" + key);
    if (!res.ok) throw new Error(res.statusText);

    const buf = await res.arrayBuffer();
    const disposition = res.headers.get("content-disposition");
    const filename = disposition
      ? disposition.split("filename=")[1]?.replace(/"/g, "")
      : "book.epub";
    const file = new File([buf], filename, {
      type: "application/epub+zip",
    });

    // store for offline usage
    await db.put("books", file, key);

    return file;
  } catch (err) {
    return cached;
  }
}

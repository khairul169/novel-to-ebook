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

export async function getOfflineImage(
  url: string,
  onDbCache?: (url: string) => void,
) {
  if (imagesCache.has(url)) {
    return imagesCache.get(url)!;
  }

  const cachedBlob = await getDB().then((db) => db.get("images", url));
  let cached: string | null = null;

  if (cachedBlob) {
    cached = URL.createObjectURL(cachedBlob);
    imagesCache.set(url, cached);
    onDbCache?.(cached);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("network");

    const blob = await res.blob();
    await getDB().then((db) => db.put("images", blob, url));

    const obj = URL.createObjectURL(blob);
    imagesCache.set(url, obj);

    return obj;
  } catch (e) {
    if (!cached) throw new Error("no cached image");
    return cached;
  }
}

async function fetchBook(key: string) {
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
    await getDB().then((db) => db.put("books", file, key));

    return file;
  } catch (err) {
    throw err;
  }
}

export async function getBookData(
  key: string,
  onFileChanged?: (file: File) => void,
) {
  const cached = await getDB().then((db) => db.get("books", key));
  const promise = fetchBook(key);

  if (cached) {
    promise.then((file) => {
      if (file.size !== cached.size) {
        onFileChanged?.(file);
      }
    });
    return cached;
  }

  return promise;
}

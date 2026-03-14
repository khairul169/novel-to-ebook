import { clsx, type ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";
import sanitizeHtml from "sanitize-html";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(
  text: string,
  options?: Partial<{ message: string }>,
) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(options?.message || "Copied to clipboard!");
  } catch (err) {
    toast.error("Failed to copy to clipboard");
  }
}

export function cleanHTML(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "span",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "img",
    ],

    allowedAttributes: {
      img: ["src", "alt", "title", "width", "height"],
      p: ["style"],
      span: ["style"],
    },

    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
  }).trim();
}

export function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function proxyUrl(url: string) {
  const baseUrl = window.location.origin;
  return baseUrl + "/api/proxy/" + url;
}

export function extractNumber(str: string) {
  return Number(str.match(/\d+/)?.[0]);
}

export function buildFilters(query: string) {
  const parts = query.split(",").map((p) => p.trim());
  const numFilters: ((n: number) => boolean)[] = [];
  const textFilters: string[] = [];

  for (const part of parts) {
    // range: 20-25 or 20..25
    let m = part.match(/^(\d+)\s*(?:-|\.{2})\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      numFilters.push((n: number) => n >= a && n <= b);
      continue;
    }

    // >=20
    m = part.match(/^>=\s*(\d+)$/);
    if (m) {
      numFilters.push((n: number) => n >= Number(m![1]));
      continue;
    }

    // <=20
    m = part.match(/^<=\s*(\d+)$/);
    if (m) {
      numFilters.push((n: number) => n <= Number(m![1]));
      continue;
    }

    // >20
    m = part.match(/^>\s*(\d+)$/);
    if (m) {
      numFilters.push((n: number) => n > Number(m![1]));
      continue;
    }

    // <20
    m = part.match(/^<\s*(\d+)$/);
    if (m) {
      numFilters.push((n: number) => n < Number(m![1]));
      continue;
    }

    // exact: 20
    m = part.match(/^\d+$/);
    if (m) {
      const x = Number(m[0]);
      numFilters.push((n: number) => n === x);
      continue;
    }

    // treat as text search
    textFilters.push(part.toLowerCase());
  }

  return { numFilters, textFilters };
}

export function searchChapters<T>(
  list: T[],
  selector: (i: T) => string,
  query: string,
) {
  const { numFilters, textFilters } = buildFilters(query);

  return list.filter((ch) => {
    const text = selector(ch).trim().toLowerCase();
    const num = extractNumber(text);
    const title = text.toLowerCase();

    const numMatch = numFilters.length === 0 || numFilters.some((f) => f(num));
    const textMatch =
      textFilters.length === 0 || textFilters.some((t) => title.includes(t));

    return numMatch && textMatch;
  });
}

type Platform = "windows" | "mac" | "linux" | "android" | "ios" | null;

export function getPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  const userAgentLower = userAgent.toLowerCase();
  if (userAgentLower.indexOf("win") !== -1) return "windows";
  if (userAgentLower.indexOf("mac") !== -1) return "mac";
  if (userAgentLower.indexOf("linux") !== -1) return "linux";
  if (userAgentLower.indexOf("android") !== -1) return "android";
  if (
    userAgentLower.indexOf("iphone") !== -1 ||
    userAgentLower.indexOf("ipad") !== -1
  )
    return "ios";
  return null;
}

export const curPlatform = getPlatform();
export const isMobile = curPlatform === "android" || curPlatform === "ios";
export const isDesktop = !isMobile;

export function sortableMoveArray<T>(items: T[], event: any): T[] {
  const source = event.operation?.source;
  const target = event.operation?.target;

  if (!source || !target) return items;

  const from = source.initialIndex;
  const to = target.index;

  if (from === to || from == null || to == null) return items;

  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);

  if (typeof copy[0] === "object" && "index" in copy[0]!) {
    copy.forEach((item, i) => {
      (item as any).index = i;
    });
  }

  return copy;
}

export function setByPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let cur = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] ??= {};
    cur = cur[k];
  }

  cur[keys[keys.length - 1]] = value;
}

export function getByPath<T = any>(obj: any, path: string): T {
  const keys = path.split(".");
  let cur = obj;

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (cur[k] == null) return null!;
    cur = cur[k];
  }

  return cur as T;
}

export function deepMerge(target: any, source: any) {
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      target[key] ??= {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

export function ucfirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

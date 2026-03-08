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

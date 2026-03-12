import fs from "fs/promises";
import path from "path";
import EPub from "epub";

export async function scanLibrary(paths: string[]) {
  const files = await Promise.all(
    paths.map(async (p) => {
      const basePath = path.resolve(p);

      let entries = await fs.readdir(p, {
        recursive: true,
        withFileTypes: true,
      });

      entries = entries.filter((entry) => {
        if (entry.isDirectory()) return true;
        if (entry.isFile() && entry.name.endsWith(".epub")) return true;
        return false;
      });

      const result = await Promise.all(
        entries.map(async (entry: any) => {
          const fullPath = path.join(entry.path ?? p, entry.name);
          const relative = path.relative(p, fullPath);
          const parent = path
            .dirname(relative)
            .replaceAll("\\", "/")
            .replaceAll(".", "")
            .replaceAll("..", "");
          const key = relative.replaceAll("\\", "/");

          let metadata: Record<string, string> | undefined = undefined;
          let getCover:
            | (() => Promise<{
                data: Buffer<ArrayBufferLike>;
                mimeType: string;
              }>)
            | undefined = undefined;
          let cover: string | null = null;

          if (entry.name.endsWith(".epub")) {
            const epub = new EPub(fullPath);
            await epub.parse();
            metadata = epub.metadata as never;

            const coverId = (epub.metadata as any).cover;
            if (coverId) {
              getCover = () => epub.getImage(coverId);
              cover = getCoverUrl(key);
            }
          }

          return {
            key,
            name: entry.name,
            path: basePath,
            parent,
            fullPath,
            isDirectory: entry.isDirectory(),
            metadata,
            cover,
            getCover,
          };
        }),
      );

      result.forEach((item, idx) => {
        if (!item.isDirectory) return;
        result[idx]!.cover =
          result.find((i) => i.parent === item.key && i.cover != null)?.cover ||
          null;
      });

      return result;
    }),
  );

  return files.flat();
}

export type LibraryItems = Awaited<ReturnType<typeof scanLibrary>>;

export function getCoverUrl(key?: string | null) {
  if (!key) return null;
  return "/library/cover.jpeg?key=" + encodeURIComponent(key);
}

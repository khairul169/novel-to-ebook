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

      return await Promise.all(
        entries.map(async (entry: any) => {
          const fullPath = path.join(entry.path ?? p, entry.name);
          const relative = path.relative(p, fullPath);
          let metadata: Record<string, string> | undefined = undefined;
          let getCover:
            | (() => Promise<{
                data: Buffer<ArrayBufferLike>;
                mimeType: string;
              }>)
            | undefined = undefined;

          if (entry.name.endsWith(".epub")) {
            const epub = new EPub(fullPath);
            await epub.parse();
            metadata = epub.metadata as never;

            const coverId = (epub.metadata as any).cover;
            if (coverId) {
              getCover = () => epub.getImage(coverId);
            }
          }

          return {
            key: relative.replaceAll("\\", "/"),
            name: entry.name,
            path: basePath,
            fullPath,
            isDirectory: entry.isDirectory(),
            metadata,
            getCover,
          };
        }),
      );
    }),
  );

  return files.flat();
}

export type LibraryItems = Awaited<ReturnType<typeof scanLibrary>>;

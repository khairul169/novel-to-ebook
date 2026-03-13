import { FontDecryptor } from "../../lib/font-decryptor";

export async function decryptTextFromFont(
  text: string[],
  opt?: { fontUrl?: string | null; decryptMap?: string | null },
) {
  const { fontUrl, decryptMap } = opt || {};
  if (!decryptMap && !fontUrl) {
    throw new Error("Either decryptMap or fontUrl is required");
  }
  let decryptor: FontDecryptor | null = null;

  if (decryptMap) {
    decryptor = FontDecryptor.fromMap(JSON.parse(decryptMap));
  } else if (fontUrl) {
    const buf = await fetch(fontUrl).then((res) =>
      res.ok ? res.arrayBuffer() : null,
    );
    if (!buf) {
      throw new Error("Failed to fetch font");
    }
    decryptor = await FontDecryptor.fromBuffer(buf);
  }

  if (!decryptor) {
    throw new Error("Failed to build decryptor");
  }

  const result = text.map((t) => decryptor.decrypt(t));

  return { map: decryptor.map, result };
}

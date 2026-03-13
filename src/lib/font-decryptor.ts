/**
 * font-decryptor.ts
 *
 * Decrypts text "encrypted" by a custom font that remaps Latin character
 * glyphs onto arbitrary non-Latin Unicode codepoints.
 *
 * A browser renders such text correctly because the font draws familiar Latin
 * shapes at the non-Latin codepoints. Copying the text or reading raw HTML
 * gives the non-Latin codepoints instead of the visible characters.
 *
 * ## How detection works
 *
 * Every glyph in the font is serialised into a canonical path-command string.
 * Any two codepoints that produce the **exact same path** are visual aliases.
 * Within each alias group the codepoint in Basic Latin (U+0020–U+007E) is the
 * true character; every other codepoint in the group is an encrypted alias.
 *
 * This means **no Unicode range needs to be specified** — the library figures
 * out the full mapping automatically from the font, and works regardless of
 * which block(s) the obfuscation uses (Sundanese, CJK, Private Use Area, etc.).
 *
 * @example
 * ```ts
 * import { FontDecryptor } from './font-decryptor';
 *
 * // Auto-detects everything — no range needed
 * const dec = await FontDecryptor.fromFile('./font.ttf');
 *
 * dec.decrypt('ᯏ ᮣᮙᮗᮘ ᮕᮣᮓᮑᮠᮕᮔ ᮝᮕᮼ');
 * // → 'A sigh escaped me.'
 *
 * dec.decryptHtml('<p>᮰ᮄᮟᮔᮑᮩ ᮧᮑᮣ...᮰</p>');
 * // → '"Today was supposed...'
 *
 * // Export a static map so you don't need the font at runtime
 * console.log(dec.toSourceString());
 * // → export const DECRYPT_MAP: Record<string, string> = { '\u1BCF': 'A', ... }
 * ```
 */

import fs from "fs";
import path from "path";
import * as opentype from "opentype.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Maps encrypted single characters to their plaintext equivalents. */
export type DecryptMap = Record<string, string>;

/**
 * Options for {@link FontDecryptor.buildMap} and the factory methods.
 */
export interface BuildMapOptions {
  /**
   * Extra codepoints to recognise as **plaintext** characters, in addition to
   * the default set (all printable ASCII U+0020–U+007E plus common typographic
   * characters such as smart quotes and em-dashes).
   *
   * Use this when the font maps to characters outside Basic Latin — e.g. if
   * the "plaintext" reference glyphs are accented Latin, Cyrillic, etc.
   *
   * @example [0x00E9, 0x00F1]  // é, ñ
   */
  extraPlaintextCandidates?: number[];

  /**
   * Only return mappings whose encrypted codepoint falls within this
   * `[start, end]` range (inclusive).
   *
   * Useful to narrow results when a font contains many unrelated duplicate
   * glyphs. Leave unset to return every encrypted alias found in the font.
   *
   * @example [0x1B80, 0x1BFF]  // Sundanese block only
   * @example [0xE000, 0xF8FF]  // Private Use Area only
   */
  encryptedRange?: [number, number];

  /**
   * When `true`, skip auto-detection and instead scan **only** `encryptedRange`
   * against the default plaintext candidates.
   *
   * This is faster if you already know the exact obfuscation range, but it
   * requires `encryptedRange` to be set.
   *
   * @default false
   */
  useRangeOnly?: boolean;
}

// ---------------------------------------------------------------------------
// opentype.js compatibility shim
// ---------------------------------------------------------------------------
// Only the surface we actually use is typed here, so @types/opentype.js is
// entirely optional — the file compiles with just `npm install opentype.js`.

interface OTPathCommand {
  type: "M" | "L" | "Q" | "C" | "Z";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}
interface OTPath {
  commands: OTPathCommand[];
}
interface OTGlyph {
  index: number;
  path?: OTPath;
  getPath?(x: number, y: number, size: number): OTPath;
}
interface OTCmap {
  getBestCmap?(): Record<number, number>;
  glyphIndexMap?: Record<number, number>;
}
interface OTGlyphSet {
  get(index: number): OTGlyph | undefined;
}
interface OTFont {
  charToGlyph?(char: string): OTGlyph;
  glyphs?: OTGlyphSet;
  tables?: { cmap?: OTCmap };
}

// ---------------------------------------------------------------------------
// Low-level font helpers
// ---------------------------------------------------------------------------

/**
 * Get a glyph by codepoint — compatible with all opentype.js versions.
 * Returns `null` for unmapped codepoints (glyph index 0 = .notdef).
 */
function getGlyph(font: OTFont, cp: number): OTGlyph | null {
  // High-level API (v0.x, older v1.x)
  if (typeof font.charToGlyph === "function") {
    const g = font.charToGlyph(String.fromCodePoint(cp));
    return g?.index ? g : null;
  }
  // Low-level cmap fallback (newer v1.x)
  const cmap = font.tables?.cmap;
  if (cmap) {
    const map =
      typeof cmap.getBestCmap === "function"
        ? cmap.getBestCmap()
        : cmap.glyphIndexMap;
    const idx = map?.[cp];
    if (idx) {
      const g = font.glyphs?.get(idx);
      return g?.index ? g : null;
    }
  }
  return null;
}

/**
 * Iterate every codepoint present in the font's cmap.
 * Falls back to a BMP scan if the cmap isn't directly accessible.
 */
function* fontCodepoints(font: OTFont): Generator<number> {
  const cmap = font.tables?.cmap;
  if (cmap) {
    const map =
      typeof cmap.getBestCmap === "function"
        ? cmap.getBestCmap()
        : cmap.glyphIndexMap;
    if (map) {
      for (const k of Object.keys(map)) yield Number(k);
      return;
    }
  }
  // Brute-force BMP fallback
  for (let cp = 0x0020; cp <= 0xffff; cp++) {
    if (getGlyph(font, cp)) yield cp;
  }
}

/**
 * Serialise a glyph's outline into a stable canonical string key.
 *
 * Renders at 1000 upem and rounds coordinates to the nearest integer so that
 * two glyphs with identical shapes always produce the same key, and two
 * different shapes always produce different keys.
 *
 * Returns `null` for blank glyphs (space, soft-hyphen, etc.).
 */
function pathKey(glyph: OTGlyph): string | null {
  const p =
    typeof glyph.getPath === "function"
      ? glyph.getPath(0, 0, 1000)
      : glyph.path;
  if (!p?.commands?.length) return null;

  const r = (n?: number) => Math.round(n ?? 0);
  return p.commands
    .map((c) => {
      switch (c.type) {
        case "M":
          return `M${r(c.x)},${r(c.y)}`;
        case "L":
          return `L${r(c.x)},${r(c.y)}`;
        case "Q":
          return `Q${r(c.x1)},${r(c.y1)},${r(c.x)},${r(c.y)}`;
        case "C":
          return `C${r(c.x1)},${r(c.y1)},${r(c.x2)},${r(c.y2)},${r(c.x)},${r(c.y)}`;
        case "Z":
          return "Z";
        default:
          return c.type;
      }
    })
    .join("|");
}

// Common typographic characters added to the plaintext reference by default.
const TYPOGRAPHIC: readonly number[] = [
  0x2018,
  0x2019, // ' '  single quotation marks
  0x201c,
  0x201d, // " "  double quotation marks
  0x2013,
  0x2014, // – —  en/em dash
  0x2026, // …    ellipsis
];

// ---------------------------------------------------------------------------
// Map-building implementations (module-private)
// ---------------------------------------------------------------------------

/**
 * Auto-detection: walk the entire font cmap, group codepoints by path key,
 * then map every non-Basic-Latin alias to its Basic Latin equivalent.
 */
function buildMapAutoDetect(
  font: OTFont,
  encryptedRange: [number, number] | undefined,
  extraPlaintext: number[],
): DecryptMap {
  // Group every font codepoint by its rendered path
  const groups = new Map<string, number[]>();

  for (const cp of fontCodepoints(font)) {
    const g = getGlyph(font, cp);
    if (!g) continue;
    const key = pathKey(g);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cp);
  }

  // Ensure extra candidates are indexed even if absent from the cmap iterator
  for (const cp of [...TYPOGRAPHIC, ...extraPlaintext]) {
    const g = getGlyph(font, cp);
    if (!g) continue;
    const key = pathKey(g);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    const list = groups.get(key)!;
    if (!list.includes(cp)) list.push(cp);
  }

  const isBasicLatin = (cp: number): boolean => cp >= 0x0020 && cp <= 0x007e;

  const map: DecryptMap = {};

  for (const codepoints of groups.values()) {
    if (codepoints.length < 2) continue;

    // Canonical plaintext priority:
    //  1. Basic Latin (U+0020–U+007E)
    //  2. User-supplied extraPlaintextCandidates
    //  3. Built-in typographic defaults
    const plaintext: number | undefined =
      codepoints.find(isBasicLatin) ??
      codepoints.find((cp) => extraPlaintext.includes(cp)) ??
      codepoints.find((cp) => (TYPOGRAPHIC as readonly number[]).includes(cp));

    if (plaintext === undefined) continue;

    const plaintextChar = String.fromCodePoint(plaintext);

    for (const cp of codepoints) {
      if (cp === plaintext) continue;
      if (encryptedRange && (cp < encryptedRange[0] || cp > encryptedRange[1]))
        continue;
      map[String.fromCodePoint(cp)] = plaintextChar;
    }
  }

  return map;
}

/**
 * Range-only: build a reference map from known plaintext candidates, then
 * scan only the specified encrypted range. Faster when the range is known.
 */
function buildMapRangeOnly(
  font: OTFont,
  [start, end]: [number, number],
  extraPlaintext: number[],
): DecryptMap {
  const candidates = [
    ...Array.from({ length: 95 }, (_, i) => i + 0x20), // all printable ASCII
    ...TYPOGRAPHIC,
    ...extraPlaintext,
  ];

  const keyToPlaintext = new Map<string, string>();
  for (const cp of candidates) {
    const g = getGlyph(font, cp);
    if (!g) continue;
    const key = pathKey(g);
    if (key && !keyToPlaintext.has(key))
      keyToPlaintext.set(key, String.fromCodePoint(cp));
  }

  const map: DecryptMap = {};
  for (let cp = start; cp <= end; cp++) {
    const g = getGlyph(font, cp);
    if (!g) continue;
    const key = pathKey(g);
    if (key) {
      const plaintext = keyToPlaintext.get(key);
      if (plaintext) map[String.fromCodePoint(cp)] = plaintext;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// FontDecryptor
// ---------------------------------------------------------------------------

/**
 * Decrypts text obfuscated by a custom font that remaps Latin characters onto
 * arbitrary Unicode codepoints.
 *
 * Create instances via:
 * - {@link FontDecryptor.fromFile}   — Node.js filesystem path
 * - {@link FontDecryptor.fromBuffer} — in-memory `Buffer` / `ArrayBuffer`
 * - {@link FontDecryptor.fromMap}    — pre-built map (no font loading needed)
 */
export class FontDecryptor {
  /**
   * Frozen map of encrypted char → plaintext char.
   * Safe to cache, share, and serialise.
   */
  public readonly map: Readonly<DecryptMap>;

  private constructor(map: DecryptMap) {
    this.map = Object.freeze({ ...map });
  }

  // ── Factories ─────────────────────────────────────────────────────────────

  /**
   * Load a font from the filesystem and build the decrypt map.
   * Auto-detects all encrypted codepoints — no range configuration needed.
   */
  static async fromFile(
    fontPath: string,
    options?: BuildMapOptions,
  ): Promise<FontDecryptor> {
    const abs = path.resolve(fontPath);
    if (!fs.existsSync(abs)) throw new Error(`Font file not found: ${abs}`);
    return FontDecryptor.fromBuffer(fs.readFileSync(abs), options);
  }

  /**
   * Load a font from an in-memory buffer and build the decrypt map.
   * Auto-detects all encrypted codepoints — no range configuration needed.
   *
   * Works in the browser too — pass the result of
   * `fetch(url).then(r => r.arrayBuffer())`.
   */
  static async fromBuffer(
    buffer: Buffer | ArrayBuffer,
    options?: BuildMapOptions,
  ): Promise<FontDecryptor> {
    let font: OTFont;
    try {
      font = opentype.parse(buffer instanceof Buffer ? buffer.buffer : buffer);
    } catch {
      font = opentype.parse(buffer as Buffer);
    }
    return new FontDecryptor(FontDecryptor.buildMap(font, options));
  }

  /**
   * Wrap a pre-built {@link DecryptMap} so you can skip font loading at runtime.
   *
   * Pair with {@link toSourceString} to generate the map once at build time
   * and bundle it as a plain TypeScript constant.
   *
   * @example
   * ```ts
   * import { DECRYPT_MAP } from './decrypt-map.generated';
   * const dec = FontDecryptor.fromMap(DECRYPT_MAP);
   * dec.decrypt('...'); // no font file needed
   * ```
   */
  static fromMap(map: DecryptMap): FontDecryptor {
    return new FontDecryptor(map);
  }

  // ── Map building ──────────────────────────────────────────────────────────

  /**
   * Build a {@link DecryptMap} from a parsed opentype.js font object.
   *
   * Useful in the browser or when you manage the font lifecycle yourself:
   * ```ts
   * import opentype from 'opentype.js';
   * const font = opentype.parse(await fetch(url).then(r => r.arrayBuffer()));
   * const dec  = FontDecryptor.fromMap(FontDecryptor.buildMap(font));
   * ```
   *
   * ### Auto-detection (default, no `encryptedRange` needed)
   *
   * Walks every codepoint in the font's cmap, groups them by rendered path,
   * and maps non-Basic-Latin aliases to their Basic Latin equivalent.
   * Works for **any** obfuscation block — Sundanese, CJK, PUA, or a mix.
   *
   * ### Range-only mode (`useRangeOnly: true`)
   *
   * Scans only `encryptedRange` against the plaintext candidate set.
   * Faster, but requires knowing the obfuscation range in advance.
   */
  static buildMap(font: OTFont, options: BuildMapOptions = {}): DecryptMap {
    const {
      extraPlaintextCandidates = [],
      encryptedRange,
      useRangeOnly = false,
    } = options;
    if (useRangeOnly) {
      if (!encryptedRange)
        throw new Error(
          "`encryptedRange` is required when `useRangeOnly` is true.",
        );
      return buildMapRangeOnly(font, encryptedRange, extraPlaintextCandidates);
    }
    return buildMapAutoDetect(font, encryptedRange, extraPlaintextCandidates);
  }

  // ── Decryption ────────────────────────────────────────────────────────────

  /**
   * Decrypt a string character by character.
   * Characters absent from the map are passed through unchanged.
   */
  decrypt(text: string): string {
    return [...text].map((ch) => this.map[ch] ?? ch).join("");
  }

  /**
   * Strip HTML tags, then decrypt the remaining text.
   * Convenient for raw scraped HTML without needing a DOM parser.
   */
  decryptHtml(html: string): string {
    return this.decrypt(html.replace(/<[^>]*>/g, ""));
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Number of mappings in the decrypt map. */
  get size(): number {
    return Object.keys(this.map).length;
  }

  /** All encrypted codepoints as numbers, sorted ascending. */
  get encryptedCodepoints(): number[] {
    return Object.keys(this.map)
      .map((ch) => ch.codePointAt(0)!)
      .sort((a, b) => a - b);
  }

  /**
   * Serialise the map as a TypeScript source snippet ready to paste into
   * your project, so you can use {@link FontDecryptor.fromMap} without
   * loading or shipping the font at runtime.
   *
   * ```ts
   * // One-time generation (build script / CLI):
   * const dec = await FontDecryptor.fromFile('./font.ttf');
   * fs.writeFileSync('decrypt-map.generated.ts', dec.toSourceString());
   *
   * // Runtime usage (no font needed):
   * import { DECRYPT_MAP } from './decrypt-map.generated';
   * const dec = FontDecryptor.fromMap(DECRYPT_MAP);
   * ```
   */
  toSourceString(): string {
    const entries = Object.entries(this.map).sort(
      (a, b) => a[0].codePointAt(0)! - b[0].codePointAt(0)!,
    );

    const lines = entries.map(([enc, dec]) => {
      const hex = enc
        .codePointAt(0)!
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      const safe = dec === "'" ? "\\'" : dec === "\\" ? "\\\\" : dec;
      return `  '\\u${hex}': '${safe}',  // ${enc} → ${dec}`;
    });

    return [
      "export const DECRYPT_MAP: Record<string, string> = {",
      ...lines,
      "};",
      `// ${entries.length} mappings`,
    ].join("\n");
  }
}
type UnicodeBlock = {
  name: string;
  start: number;
  end: number;
};

type BlockMatch = {
  name: string;
  range: [number, number];
  matches: number;
};

type DetectionResult = {
  encrypted: boolean;
  confidence: number;
  suspiciousRatio: number;
  uniqueChars: number;
  blocks: BlockMatch[];
};

const BLOCKS: UnicodeBlock[] = [
  { name: "Sundanese", start: 0x1b80, end: 0x1bbf },
  { name: "Balinese", start: 0x1b00, end: 0x1b7f },
  { name: "Javanese", start: 0xa980, end: 0xa9df },
  { name: "Khmer", start: 0x1780, end: 0x17ff },
  { name: "Myanmar", start: 0x1000, end: 0x109f },
  { name: "Katakana", start: 0x30a0, end: 0x30ff },
  { name: "Bopomofo", start: 0x3100, end: 0x312f },
  { name: "Georgian", start: 0x10a0, end: 0x10ff },
  { name: "Armenian", start: 0x0530, end: 0x058f },
  { name: "Ethiopic", start: 0x1200, end: 0x137f },
  { name: "Runic", start: 0x16a0, end: 0x16ff },
  { name: "Ogham", start: 0x1680, end: 0x169f },
  { name: "Private Use Area", start: 0xe000, end: 0xf8ff },
];

export function hex(n: number) {
  return "U+" + n.toString(16).toUpperCase();
}

export function detectObfuscatedContent(text: string): DetectionResult {
  const counts = new Map<string, number>();
  const unique = new Set<string>();

  let suspicious = 0;
  let total = 0;

  for (const ch of text) {
    if (/\s/.test(ch)) continue;

    const code = ch.codePointAt(0);
    if (!code) continue;

    total++;
    unique.add(ch);

    for (const block of BLOCKS) {
      if (code >= block.start && code <= block.end) {
        suspicious++;
        counts.set(block.name, (counts.get(block.name) ?? 0) + 1);
      }
    }
  }

  const suspiciousRatio = total === 0 ? 0 : suspicious / total;

  const blocks: BlockMatch[] = [...counts.entries()].map(([name, matches]) => {
    const b = BLOCKS.find((b) => b.name === name)!;
    return {
      name,
      range: [b.start, b.end],
      matches,
    };
  });

  const uniqueChars = unique.size;

  // heuristic scoring
  let confidence = 0;
  if (suspiciousRatio > 0.3) confidence += 0.5;
  if (uniqueChars > 20) confidence += 0.3;
  if (blocks.length > 0) confidence += 0.2;

  return {
    encrypted: confidence >= 0.5,
    confidence,
    suspiciousRatio,
    uniqueChars,
    blocks,
  };
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { llmChat } from "@/lib/llm";
import { createDisclosure } from "@/lib/store";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const translateModal = createDisclosure<{
  text: string;
  onSave: (text: string) => void;
}>();

const langList = [
  { label: "Auto", value: "auto" },
  { label: "English", value: "en" },
  { label: "Indonesian", value: "id" },
  { label: "Japanese", value: "jp" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TextMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Step 1 – Extract text nodes from HTML
// ---------------------------------------------------------------------------

/** Tags whose text content must not be translated */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "VAR",
  "MATH",
  "SVG",
]);

function extractTextNodes(
  document: Document,
  skipNode?: (node: Node) => boolean,
): Map<string, Text> {
  const textNodes = new Map<string, Text>();
  let counter = 0;

  function walk(node: Node): void {
    // Skip user-defined nodes
    if (skipNode?.(node)) return;

    // Skip technical tags
    if (
      node.nodeType === node.ELEMENT_NODE &&
      SKIP_TAGS.has((node as Element).tagName)
    )
      return;

    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent ?? "";
      // Only store non-whitespace-only nodes
      if (text.trim().length > 0) {
        const key = `t${counter++}`;
        (node as Text).textContent = `{{${key}}}`; // placeholder
        textNodes.set(key, node as Text);
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  }

  walk(document.body ?? document.documentElement);
  return textNodes;
}

// ---------------------------------------------------------------------------
// Step 2 – Build a compact JSON map  { t0: "original text", … }
// ---------------------------------------------------------------------------

function buildTextMap(
  originalHtml: string,
  textNodes: Map<string, Text>,
): TextMap {
  // We need the ORIGINAL text before we replaced it with placeholders.
  // Re-parse the original HTML to get a clean copy, then extract in the
  // same order.  Simpler approach: capture the originals during extraction
  // by storing them alongside.  We handle this by passing originals in.
  // (See extractWithOriginals below.)
  void originalHtml; // unused in this version — see extractWithOriginals
  const map: TextMap = {};
  for (const [key, node] of textNodes) {
    map[key] = node.textContent?.replace(/^\{\{t\d+\}\}$/, "") ?? "";
  }
  return map;
}

// Revised extraction that captures original text before mutating
function extractWithOriginals(
  document: Document,
  skipNode?: (node: Node) => boolean,
): { textNodes: Map<string, Text>; originalMap: TextMap } {
  const textNodes = new Map<string, Text>();
  const originalMap: TextMap = {};
  let counter = 0;

  function walk(node: Node): void {
    if (skipNode?.(node)) return;
    if (
      node.nodeType === node.ELEMENT_NODE &&
      SKIP_TAGS.has((node as Element).tagName)
    )
      return;

    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim().length > 0) {
        const key = `t${counter++}`;
        originalMap[key] = text; // capture BEFORE mutation
        (node as Text).textContent = `{{${key}}}`;
        textNodes.set(key, node as Text);
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  }

  walk(document.body ?? document.documentElement);
  return { textNodes, originalMap };
}

function cleanText(text: string) {
  return text
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/^\n+|\n+$/g, "") // remove leading/trailing newlines
    .trim();
}

function prompt(source: string, target: string, additionalPrompt?: string) {
  const sourceLangNote =
    source !== "auto"
      ? `Source language: ${source}.`
      : "Auto-detect the source language.";

  const system = `You are a professional Light Novel translator with a deep understanding of prose, subtext, and cultural nuances.
${sourceLangNote}
Translate the text I send you to '${target}'. The goal is to maintain the "Light Novel" atmosphere—elegant, immersive, and flowing—without sounding robotic or overly informal.
${additionalPrompt}

Rules:
- Return only the text with html tags. No explanation.
- Preserve whitespace patterns (leading/trailing spaces, newlines) and symbols/quotation marks (", ', “) in each value, dont replace them to another character.
- Do NOT translate proper nouns, brand names, code identifiers, or URLs.
- KEEP the HTML structure intact!

Strict Rules:
- Narrative Style: Use a literary prose style for narrations. The flow should be smooth and evocative, capturing the descriptive nature of Japanese storytelling.
- Tone & Register: Use "Semi-Formal" tone. Use "aku" instead of "saya". Avoid slang and overly casual contractions unless explicitly required by a character's unique speaking habit.
- Honorifics & Terms: Retain Japanese honorifics (e.g., -san, -kun, -sama, -chan, Senpai) to preserve the original flavor. Do not translate specific Japanese terms that are common in the community (e.g., Hikikomori, Chuunibyou) unless context requires a localized term.
- Localization vs. Literalism: Do not translate word-for-word. Adjust English idioms and passive voice into natural Indonesian structures. Ensure the "internal monologue" feels intimate and reflective.
- Dialogue Consistency: Distinguish clearly between the elegant, descriptive narration and the character's unique dialogue voices. Keep the dialogue "In-Character" without making it cringe.`;

  return system.trim();
}

async function translateMap(
  originalMap: TextMap,
  source: string,
  target: string,
  onBuffer?: ((text: string) => void) | null,
  controller?: AbortController,
): Promise<TextMap> {
  const sourceLangNote = source
    ? `Source language: ${source}.`
    : "Auto-detect the source language.";

  const system = `You are a professional Light Novel translator with a deep understanding of prose, subtext, and cultural nuances.
${sourceLangNote}
Translate all values in the JSON object I send you to ${target}. The goal is to maintain the "Light Novel" atmosphere—elegant, immersive, and flowing—without sounding robotic or overly informal.

Rules:
- Return ONLY valid JSON - no markdown fences, no explanation. Keep every key exactly as-is (t0, t1, ...).
- Preserve whitespace patterns (leading/trailing spaces, newlines) and symbols/quotation marks (", ', “) in each value, dont replace them to another character.
- Do NOT translate proper nouns, brand names, code identifiers, or URLs.

Strict Rules:
- Narrative Style: Use a literary prose style for narrations. The flow should be smooth and evocative, capturing the descriptive nature of Japanese storytelling.
- Tone & Register: Use "Semi-Formal" tone. Use "aku" instead of "saya". Avoid slang and overly casual contractions unless explicitly required by a character's unique speaking habit.
- Honorifics & Terms: Retain Japanese honorifics (e.g., -san, -kun, -sama, -chan, Senpai) to preserve the original flavor. Do not translate specific Japanese terms that are common in the community (e.g., Hikikomori, Chuunibyou) unless context requires a localized term.
- Localization vs. Literalism: Do not translate word-for-word. Adjust English idioms and passive voice into natural Indonesian structures. Ensure the "internal monologue" feels intimate and reflective.
- Dialogue Consistency: Distinguish clearly between the elegant, descriptive narration and the character's unique dialogue voices. Keep the dialogue "In-Character" without making it cringe.`;

  const userMessage = JSON.stringify(originalMap, null, 0);

  const response = await llmChat(
    "translategemma:4b",
    [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    onBuffer,
    controller,
  );

  // Strip optional markdown code fences the model might add
  const cleaned = cleanText(response);

  try {
    return JSON.parse(cleaned) as TextMap;
  } catch {
    throw new Error(`LLM returned non-JSON response:\n${cleaned}`);
  }
}

function createTextChunks(text: string, maxChunkLength: number) {
  const chunks: string[] = [];
  let remainder = text;

  while (remainder.length > maxChunkLength) {
    const currentChunk = remainder.slice(0, maxChunkLength);
    remainder = remainder.slice(maxChunkLength);
    chunks.push(currentChunk);
  }

  if (remainder.length > 0) chunks.push(remainder);
  return chunks;
}

function createObjectChunks(object: TextMap, maxChunkLength: number) {
  const chunks: TextMap[] = [];
  let remainder = object;

  while (Object.keys(remainder).length > maxChunkLength) {
    const currentChunk = Object.fromEntries(
      Object.entries(remainder).slice(0, maxChunkLength),
    );
    remainder = Object.fromEntries(
      Object.entries(remainder).slice(maxChunkLength),
    );
    chunks.push(currentChunk);
  }

  if (Object.keys(remainder).length > 0) chunks.push(remainder);
  return chunks;
}

function splitSafeHTML(input: string) {
  const lastOpen = input.lastIndexOf("<");
  const lastClose = input.lastIndexOf(">");

  // If last "<" comes after last ">", it's incomplete
  if (lastOpen > lastClose) {
    return {
      safe: input.slice(0, lastOpen),
      remainder: input.slice(lastOpen),
    };
  }

  return {
    safe: input,
    remainder: "",
  };
}

function serializeTranslatedOnly(doc: Document): string {
  const clone = doc.body?.cloneNode(true) as Element;

  // Walk the clone and blank out any node still holding a placeholder
  const walker = doc.createTreeWalker(clone, 0x4 /* NodeFilter.SHOW_TEXT */);
  const pending: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (/^\{\{t\d+\}\}$/.test(node.textContent ?? "")) {
      pending.push(node);
    }
  }
  // Remove (or replace with empty string) so they don't appear in output
  for (const n of pending) n.textContent = "";

  return clone.innerHTML;
}

function parsePartialJson(partial: string): Record<string, string> {
  let str = partial.trim();
  if (!str.startsWith("{")) return {};

  const result: Record<string, string> = {};

  // Strip opening brace
  str = str.slice(1).trimStart();

  const keyValRegex = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)("?)/g;
  let match: RegExpExecArray | null;

  while ((match = keyValRegex.exec(str)) !== null) {
    const key = match[1];
    const value = match[2];
    const closingQt = match[3]; // `"` if value is closed, `` if still streaming

    // Unescape JSON escape sequences in the value
    try {
      result[key] = JSON.parse(`"${value}"`);
    } catch {
      result[key] = value; // fallback: use raw if unescape fails
    }

    // If no closing quote, this is the last (still-streaming) entry — stop here
    if (!closingQt) break;
  }

  return result;
}

function reinsertTranslations(
  textNodes: Map<string, Text>,
  translatedMap: TextMap,
): void {
  for (const [key, node] of textNodes) {
    const translated = translatedMap[key];
    if (translated !== undefined) {
      node.textContent = translated;
    }
  }
}

/**
 * Splits HTML-formatted web novel content into chunks suitable for LLM translation
 * @param htmlContent - The HTML content to split
 * @param maxTokens - Maximum tokens per chunk (default 4096)
 * @param overlapTokens - Number of tokens to overlap between chunks (default 200)
 * @returns Array of text chunks with metadata
 */
function splitWebNovelContent(
  htmlContent: string,
  maxTokens: number = 4096,
  overlapTokens: number = 200,
): Array<{
  text: string;
  chunkIndex: number;
  originalPosition: { start: number; end: number };
}> {
  // First extract text content while preserving paragraph structure
  const textContent = extractTextWithParagraphs(htmlContent);
  console.log("text", htmlContent);

  // Split into paragraphs (preserving newlines)
  const paragraphs = textContent
    .split(/<\/p>/i) // Splits at every closing </p> tag (case-insensitive)
    .map((i) => `${i}</p>`)
    .filter((p) => p.trim().length > 0);
  console.log("paragraphs", paragraphs.length);
  console.log(paragraphs.slice(0, 3));

  const chunks: Array<{
    text: string;
    chunkIndex: number;
    originalPosition: { start: number; end: number };
  }> = [];
  let currentChunk = "";
  let currentChunkStart = 0;
  let currentChunkTokenCount = 0;

  // Simple token estimation (1 token ≈ 4 characters for English)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphTokens = estimateTokens(paragraph);

    // Check if adding this paragraph would exceed token limit
    if (currentChunkTokenCount + paragraphTokens > maxTokens) {
      // Save current chunk before adding new paragraph
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          chunkIndex: chunks.length,
          originalPosition: {
            start: currentChunkStart,
            end: i - 1,
          },
        });
      }

      // Add overlap from previous chunk
      const overlapText = getOverlapText(paragraphs, i - 1, overlapTokens);
      currentChunk = overlapText + "\n" + paragraph;
      currentChunkStart = i - 1;
      currentChunkTokenCount = estimateTokens(currentChunk);
    } else {
      if (currentChunk.length > 0) {
        currentChunk += "\n";
      }
      currentChunk += paragraph;
      currentChunkTokenCount += paragraphTokens;
    }
  }

  // Add the last chunk if it exists
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      chunkIndex: chunks.length,
      originalPosition: {
        start: currentChunkStart,
        end: paragraphs.length - 1,
      },
    });
  }

  return chunks;
}

/**
 * Extracts text content while preserving paragraph structure
 */
function extractTextWithParagraphs(html: string): string {
  // Simple HTML to text conversion that preserves paragraphs
  return (
    html
      // .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
  );
}

/**
 * Gets overlap text from previous paragraphs
 */
function getOverlapText(
  paragraphs: string[],
  startIndex: number,
  maxTokens: number,
): string {
  if (startIndex < 0) return "";

  let overlapText = "";
  let tokenCount = 0;

  for (let i = startIndex; i >= 0 && tokenCount < maxTokens; i--) {
    const paragraph = paragraphs[i];
    const paragraphTokens = Math.ceil(paragraph.length / 4);

    if (tokenCount + paragraphTokens > maxTokens) {
      // Take only part of the paragraph
      const remainingTokens = maxTokens - tokenCount;
      const remainingChars = remainingTokens * 4;
      overlapText =
        paragraph.substring(paragraph.length - remainingChars) +
        "\n" +
        overlapText;
      tokenCount = maxTokens;
    } else {
      overlapText = paragraph + "\n" + overlapText;
      tokenCount += paragraphTokens;
    }
  }

  return overlapText.trim();
}

export default function TranslateModal() {
  const contentRef = useRef<HTMLDivElement>(null!);
  const { open, data } = translateModal.useStore();
  const [srcLang, setSrcLang] = usePersistedState(
    "translate-modal-src-lang",
    langList[0].value,
  );
  const [targetLang, setTargetLang] = usePersistedState(
    "translate-modal-target-lang",
    langList[1].value,
  );
  const [additionalPrompt, setAdditionalPrompt] = usePersistedState(
    "translate-modal-additional-prompt",
    "",
  );
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const controller = useRef<AbortController>(null);
  const translate = useMutation({
    mutationFn: async (text: string) => {
      // Extract text nodes + build original text map
      // const dom = new DOMParser().parseFromString(text, "text/html");
      // const { textNodes, originalMap } = extractWithOriginals(dom);

      // if (Object.keys(originalMap).length === 0) {
      //   return; // nothing to translate
      // }

      // console.log(JSON.stringify(originalMap, null, 2));

      // console.log(
      //   `  Extracted ${Object.keys(originalMap).length} text nodes for translation.`,
      // );

      // Translate
      // const mapChunks = createObjectChunks(originalMap, 20);
      // let buffer = "";

      // for (let c = 0; c < mapChunks.length; c++) {
      //   const chunk = mapChunks[c];
      //   controller.current = new AbortController();
      //   const out = await translateMap(
      //     chunk,
      //     srcLang,
      //     targetLang,
      //     (buf) => {
      //       buffer += buf;
      //       const json = parsePartialJson(cleanText(buffer));

      //       setProgress(
      //         (Object.keys(json).length / Object.keys(originalMap).length) *
      //           100,
      //       );

      //       reinsertTranslations(textNodes, json);
      //       const res = serializeTranslatedOnly(dom);
      //       setContent(res);
      //       contentRef.current.scrollTop = contentRef.current.scrollHeight;
      //     },
      //     controller.current,
      //   );

      //   reinsertTranslations(textNodes, out);
      //   const res = serializeTranslatedOnly(dom);
      //   setContent(res);
      //   console.log("chunk", res);
      //   contentRef.current.scrollTop = contentRef.current.scrollHeight;
      // }

      const chunks = splitWebNovelContent(text, 2048);
      let buffer = "";
      console.log("Chunks:", chunks.length);

      for (let c = 0; c < chunks.length; c++) {
        controller.current = new AbortController();
        const chunk = chunks[c];
        console.log("Chunk length:", chunk.text.length);
        const out = await llmChat(
          "translategemma:4b",
          [
            {
              role: "system",
              content: prompt(srcLang, targetLang, additionalPrompt),
            },
            {
              role: "user",
              content: chunk.text,
            },
          ],
          (chunk) => {
            buffer += chunk;
            setContent(splitSafeHTML(buffer).safe);
            setProgress((c / chunks.length) * 100);
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
          },
          controller.current,
        );
        chunks[c].text = out;
      }

      // const result = new XMLSerializer().serializeToString(dom);
      // console.log(result);
      // setContent(result);

      const result = chunks.map((chunk) => chunk.text).join("\n");
      console.log(result);
      setContent(result);
      setProgress(null);
    },
    onError(err) {
      if (err.message.toLowerCase().includes("aborted")) return;
      toast.error((err as Error).message);
    },
  });

  useEffect(() => {
    if (open) {
      setContent(data?.text || "");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={translateModal.setOpen}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Translate Chapter</DialogTitle>
          <DialogDescription>
            Translate the chapter into another language
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="flex items-center gap-2">
            <Select value={srcLang} onValueChange={setSrcLang}>
              <SelectTrigger>
                <SelectValue placeholder="Source Language" />
              </SelectTrigger>
              <SelectContent>
                {langList.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>to</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger>
                <SelectValue placeholder="Target Language" />
              </SelectTrigger>
              <SelectContent>
                {langList.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="Additional Prompt"
            />

            <div className="flex-1" />

            <Button
              onClick={() => {
                if (translate.isPending) {
                  controller.current?.abort();
                  translate.reset();
                } else {
                  translate.mutate(data?.text || "");
                }
              }}
              variant={translate.isPending ? "destructive" : "default"}
            >
              {translate.isPending && <Loader2 className="mr-2 animate-spin" />}
              {translate.isPending ? "Abort" : "Translate"}
            </Button>
          </div>

          {progress != null && (
            <Progress
              className="mt-2 w-full"
              value={progress}
              max={100}
              color="violet"
            />
          )}

          <div
            ref={contentRef}
            className="mt-4 h-[calc(100vh-400px)] overflow-y-scroll prose dark:prose-invert max-w-full"
            dangerouslySetInnerHTML={{ __html: content }}
          ></div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!content.length || translate.isPending}
            onClick={() => {
              data?.onSave?.(content);
              translateModal.setOpen(false);
            }}
          >
            Replace Content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

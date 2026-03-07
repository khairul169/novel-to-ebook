import { useCallback, useRef, useState } from "react";
import ScreenshotViewer from "./components/screenshot-viewer";
import { cleanHTML, cn, proxyUrl, saveAs } from "./lib/utils";
import { Toaster } from "./components/ui/sonner";
import { Field, FieldLabel } from "./components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "./components/ui/input-group";
import {
  DownloadIcon,
  EyeIcon,
  ImportIcon,
  PencilIcon,
  PlusIcon,
  SquareDashedMousePointerIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import * as cheerio from "cheerio";
import { Label } from "./components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import Epub from "@epubkit/epub-gen-memory/bundle";
import { Separator } from "./components/ui/separator";
import ImportTOCDialog from "./components/import-toc-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { ofetch } from "ofetch";

const API = "/api";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [url, setUrl] = useState("");
  const [selectedSelector, setSelectedSelector] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState<{
    screenshot: string;
    elements: any[];
    url: string;
    pageSize: { width: number; height: number };
    html: string;
  } | null>(null);

  const [chapters, setChapters] = useState<{ title: string; url: string }[]>(
    [],
  );

  const [contentPreview, setContentPreview] = useState<{
    content: string;
  } | null>(null);

  const [onSelectFn, setOnSelectFn] = useState<((el: any) => void) | null>(
    null,
  );

  const [title, setTitle] = useState("");
  const [coverImg, setCoverImg] = useState("");
  const [selectors, setSelectors] = useState<{
    chapter: string;
    content: string;
    nextChapter: string;
  }>({
    chapter: "",
    content: "",
    nextChapter: "",
  });

  // const [extractData, setExtractData] = useState(null);
  // const [extractLoading, setExtractLoading] = useState(false);

  const handleLoad = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setPageData(null);
    setSelectedSelector("");
    // setExtractData(null);

    try {
      let target = url.trim();
      if (!/^https?:\/\//i.test(target)) target = "https://" + target;

      const body = {
        url: target,
        width: containerRef.current.offsetWidth,
        // height: containerRef.current.offsetHeight,
        height: 2000,
        scrollY: 0,
        isFullPage: true,
      };

      const res = await fetch(`${API}/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Server error");

      const data = await res.json();
      setPageData(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // const handleExtract = async () => {
  //   if (!selectedSelector || !pageData) return;
  //   setExtractLoading(true);
  //   setExtractData(null);
  //   try {
  //     const res = await fetch(`${API}/extract`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ url: pageData.url, selector: selectedSelector }),
  //     });
  //     if (!res.ok) throw new Error((await res.json()).error || "Server error");
  //     const data = await res.json();
  //     setExtractData(data);
  //   } catch (err) {
  //     setExtractData({ error: err.message });
  //   } finally {
  //     setExtractLoading(false);
  //   }
  // };

  const onPickSelector = useCallback(
    (name: keyof typeof selectors, el: any) => {
      toast.success("Picked selector for " + name);
      setOnSelectFn(null);
      setSelectors((prev) => ({ ...prev, [name]: el.selector }));
    },
    [],
  );

  const onPreview = useCallback(() => {
    if (!pageData) return;

    const $ = cheerio.load(pageData.html);
    let content = cleanHTML($(selectors.content).html() || "");

    if (!content.length) {
      return toast.error("Cannot extract content! Please check selectors.");
    }

    const imageRegex = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg))/gi;
    content = content.replace(imageRegex, proxyUrl("$1"));

    setContentPreview({
      content,
    });
  }, [pageData, selectors]);

  const onDownload = useCallback(async () => {
    try {
      const res = await ofetch("/api/extract", {
        method: "post",
        body: { chapters, contentSelector: selectors.content },
      });

      if (res.chapters) {
        Epub(
          {
            title,
            cover: coverImg,
            imageTransformer(image) {
              if (image.url.startsWith(proxyUrl(""))) {
                return image;
              }

              image.url = proxyUrl(image.url);
              return image;
            },
            ignoreFailedDownloads: true,
          },
          res.chapters,
        ).then((epub) => {
          const blob = new Blob([epub], { type: "application/epub+zip" });
          saveAs(blob, `${title}.epub`);
        });
      }
    } catch (err) {
      console.error(err);
    }
    // const $ = cheerio.load(pageData.html);
    // const chapter = $(selectors.chapter).text();
    // const content = cleanHTML($(selectors.content).html() || "");

    // const chapters = [
    //   {
    //     title: chapter,
    //     content,
    //   },
    // ];

    // Epub(
    //   {
    //     title,
    //     cover: coverImg,
    //     imageTransformer(image) {
    //       image.url = proxyUrl(image.url);
    //       return image;
    //     },
    //   },
    //   chapters,
    // ).then((epub) => {
    //   const blob = new Blob([epub], { type: "application/epub+zip" });
    //   saveAs(blob, `${title}.epub`);
    // });
  }, [selectors, title, coverImg]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="z-10 flex h-15 shrink-0 items-center gap-6 border-b border-zinc-800 bg-zinc-900 px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Spider />
          <span className="font-mono text-[15px] font-bold tracking-[-0.5px] text-cyan-400">
            WebNovelify
          </span>
        </div>

        <form onSubmit={handleLoad} className="flex flex-1 gap-2 max-w-175">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">
              https://
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={(e) =>
                setUrl(
                  e.target.value
                    .trim()
                    .replace("https://", "")
                    .replace("http://", ""),
                )
              }
              placeholder="example.com/page"
              className="h-9.5 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-18 pr-3 font-mono text-[13px] text-zinc-200 outline-none transition-colors focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "rounded-md px-5 font-mono text-[13px] font-bold whitespace-nowrap transition",
              loading
                ? "cursor-not-allowed bg-zinc-800 text-zinc-400"
                : "cursor-pointer bg-cyan-400 text-black hover:bg-cyan-300",
            )}
          >
            {loading ? "Loading..." : "▶  Open"}
          </button>
        </form>

        {pageData && (
          <div className="shrink-0 font-mono text-[11px] text-emerald-400">
            ✓ {pageData.elements.length} elements
          </div>
        )}
      </header>

      {error && (
        <div className="border-b border-red-500/40 bg-red-950 px-6 py-2.5 font-mono text-xs text-red-400">
          ✗ {error}
        </div>
      )}

      {/* <div className="flex flex-1 overflow-hidden"> */}
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <div
            ref={containerRef}
            className="h-full overflow-hidden flex flex-col items-center justify-center"
          >
            {!pageData && !loading && <EmptyState />}
            {loading && <LoadingView />}

            {pageData && (
              <ScreenshotViewer
                screenshot={pageData.screenshot}
                elements={pageData.elements}
                selectedSelector={selectedSelector}
                pageSize={pageData.pageSize}
                isSelecting={onSelectFn != null}
                onSelect={onSelectFn}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="25%">
          <div className="p-4 space-y-3 overflow-y-auto h-full">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  placeholder="My WebNovel"
                  className="min-h-auto"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => {
                      setOnSelectFn(() => {
                        return !onSelectFn
                          ? (el: any) => {
                              setTitle(el.text);
                              setOnSelectFn(null);
                            }
                          : null;
                      });
                    }}
                  >
                    <SquareDashedMousePointerIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel>Cover Image Url</FieldLabel>
              {coverImg?.startsWith("http") && (
                <img
                  src={proxyUrl(coverImg)}
                  alt="cover"
                  className="w-auto! h-20 object-contain self-start"
                />
              )}
              <InputGroup>
                <InputGroupInput
                  placeholder="https://"
                  value={coverImg}
                  onChange={(e) => setCoverImg(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => {
                      setOnSelectFn(() => {
                        return !onSelectFn
                          ? (el: any) => {
                              setCoverImg(el.attrs?.src || "");
                              setOnSelectFn(null);
                            }
                          : null;
                      });
                    }}
                  >
                    <SquareDashedMousePointerIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel>Content Selector</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  placeholder="div.content"
                  className="min-h-auto"
                  value={selectors.content}
                  onChange={(e) =>
                    setSelectors({ ...selectors, content: e.target.value })
                  }
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => {
                      setOnSelectFn(() => {
                        return !onSelectFn
                          ? (el: any) => onPickSelector("content", el)
                          : null;
                      });
                    }}
                  >
                    <SquareDashedMousePointerIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Separator />

            <div>
              <Label>Table of Contents</Label>
              <div className="mt-2 gap-2 flex">
                <Button variant="outline" title="Add">
                  <PlusIcon />
                </Button>
                <ImportTOCDialog onImport={setChapters}>
                  <Button variant="outline" title="Import">
                    <ImportIcon />
                  </Button>
                </ImportTOCDialog>
              </div>

              <div className="space-y-2 mt-2 max-h-55 overflow-y-auto">
                {chapters.map((chapter) => (
                  <div className="flex items-center border-b">
                    <a
                      href={chapter.url}
                      target="_blank"
                      className="flex-1 truncate text-sm"
                    >
                      {chapter.title}
                    </a>
                    <Button variant="ghost" size="icon-sm">
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm">
                      <TrashIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Button onClick={onPreview} variant="outline">
                <EyeIcon /> Preview
              </Button>
              <Button
                onClick={onDownload}
                disabled={!pageData || !title || !selectors.content}
              >
                <DownloadIcon /> Download
              </Button>
            </div>

            <Dialog
              open={!!contentPreview}
              onOpenChange={(open) => (!open ? setContentPreview(null) : null)}
            >
              <DialogContent className="max-w-3xl!">
                <DialogHeader>
                  <DialogTitle>Content Preview</DialogTitle>
                </DialogHeader>

                {contentPreview && (
                  <div
                    className="prose dark:prose-invert overflow-y-auto w-full max-w-max max-h-100 border p-4 rounded mt-1"
                    dangerouslySetInnerHTML={{
                      __html: contentPreview.content,
                    }}
                  />
                )}

                <DialogFooter>
                  <Button onClick={() => setContentPreview(null)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Toaster />
    </div>
  );
}

function Spider() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="var(--accent)" opacity="0.9" />
      <line
        x1="12"
        y1="2"
        x2="12"
        y2="8"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="16"
        x2="12"
        y2="22"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="12"
        x2="8"
        y2="12"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="12"
        x2="22"
        y2="12"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="4.9"
        y1="4.9"
        x2="9.2"
        y2="9.2"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="14.8"
        y1="14.8"
        x2="19.1"
        y2="19.1"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="19.1"
        y1="4.9"
        x2="14.8"
        y2="9.2"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="9.2"
        y1="14.8"
        x2="4.9"
        y2="19.1"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 48,
        color: "var(--text2)",
      }}
    >
      <div style={{ fontSize: 64, opacity: 0.15 }}>🕷</div>
      <p
        style={{
          fontFamily: "var(--mono)",
          fontSize: 13,
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        Enter a URL above to capture
        <br />a screenshot and inspect elements
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 8,
          opacity: 0.6,
        }}
      >
        {["wikipedia.org", "news.ycombinator.com", "github.com"].map((s) => (
          <div
            key={s}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--accent)",
              opacity: 0.7,
            }}
          >
            → {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div style={{ position: "relative", width: 48, height: 48 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            opacity: 0.3,
            animation: "pulse-ring 1.2s ease-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            opacity: 0.6,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--text2)",
        }}
      >
        Launching browser…
      </div>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import ScreenshotViewer from "./components/screenshot-viewer";
import { cleanHTML, proxyUrl } from "../../lib/utils";
import { Field, FieldLabel } from "../../components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "../../components/ui/input-group";
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
import { Button } from "../../components/ui/button";
import * as cheerio from "cheerio";
import { Label } from "../../components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Separator } from "../../components/ui/separator";
import ImportTOCDialog from "./components/import-toc-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { usePersistedState } from "../../hooks/use-persisted-state";
import DownloadDialog from "./components/download-dialog";
import { streamSSE } from "../../lib/sse";
import api from "../../lib/api";
import Tasks from "./components/tasks";
import { Link } from "react-router";
import { Input } from "@/components/ui/input";

export default function ExtractPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [url, setUrl] = usePersistedState("app/url", "");
  const [selectedSelector, setSelectedSelector] = useState("");
  const [delayChapter, setDelayChapter] = useState(3);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [pageData, setPageData] = useState<{
    elements: any[];
    url: string;
    pageSize: { width: number; height: number };
    html: string;
  } | null>(null);

  const [chapters, setChapters] = usePersistedState<
    { title: string; url: string }[]
  >("app/chapters", []);

  const [contentPreview, setContentPreview] = useState<{
    chapter: string | null;
    content: string;
    isVisible: boolean;
  } | null>(null);

  const [onSelectFn, setOnSelectFn] = useState<((el: any) => void) | null>(
    null,
  );

  const [title, setTitle] = usePersistedState("app/title", "");
  const [coverImg, setCoverImg] = usePersistedState("app/cover", "");
  const [selectors, setSelectors] = usePersistedState<{
    chapter: string;
    content: string;
  }>("app/selectors", {
    chapter: "",
    content: "",
  });
  const [downloadProgress, _setDownloadProgress] = useState<{
    status: string;
    progress: number;
  } | null>(null);

  const onLoad = async (siteUrl: string) => {
    setLoading(true);
    setError("");
    setScreenshot("");
    setPageData(null);
    setSelectedSelector("");

    try {
      let target = siteUrl.trim();
      if (!/^https?:\/\//i.test(target)) target = "https://" + target;

      const body = {
        url: target,
        width: containerRef.current.offsetWidth,
        isFullPage: true,
        ignoreDuplicates: true,
      };

      await streamSSE("/extract/snapshot", "post", {
        body,
        onMessage: (event, data) => {
          if (event === "screenshot") {
            setScreenshot(data.img);
          }
          if (event === "result") {
            setPageData(data);

            const $ = cheerio.load(data.html);
            const pageTitle = $("h1, h2, h3, h4, b, strong")
              .first()
              .text()
              .trim();
            if (!title && pageTitle) {
              setTitle(pageTitle);
            }

            if (!selectors.content) {
              setSelectors((prev) => ({
                ...prev,
                content: data.contentSelector,
              }));
            }

            if (!coverImg) {
              const img = $(data.contentSelector)
                .parent()
                .find("img")
                .first()
                .attr("src");
              img && setCoverImg(img);
            }

            if (!chapters.length) {
              const chapter = $(data.contentSelector)
                .find("h1, h2, h3, h4, b, strong")
                .filter((_, i) => $(i).text().trim().length > 0)
                .first()
                .text()
                .trim();
              setChapters([
                {
                  title: chapter || title || "Chapter 1",
                  url: data.url,
                },
              ]);
            }
          }
        },
      });

      // setPageData(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url.trim()) return;
    onLoad(url);
  };

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
    const chapter = selectors.chapter
      ? $(selectors.chapter)
          .filter((_, i) => $(i).text().trim().length > 0)
          .first()
          .text()
          .trim()
      : null;
    let content = cleanHTML($(selectors.content).html() || "");

    if (!content.length) {
      return toast.error("Cannot extract content! Please check selectors.");
    }

    content = content
      .replace(/src="\/\//g, 'src="https://')
      .replace(
        /(src=")(https?:\/\/[^"]+)/gi,
        (_, prefix, url) => prefix + proxyUrl(url),
      );

    setContentPreview({ chapter, content, isVisible: true });
  }, [pageData, selectors]);

  const onDownload = useCallback(async () => {
    const body = {
      title,
      cover: coverImg,
      author: "Storvi",
      chapters,
      selectors,
      delayChapter,
    };
    await api.POST("/extract", {
      body,
    });
  }, [selectors, title, coverImg, chapters, delayChapter]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Tasks />

      <header className="z-10 flex h-15 shrink-0 items-center gap-6 border-b border-border bg-white dark:bg-background px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            to="/"
            className="font-mono text-[20px] font-bold tracking-[-0.5px] text-foreground"
          >
            Storvi
          </Link>
        </div>

        <form onSubmit={handleLoad} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com/page"
            />
          </div>
          <Button type="submit" disabled={loading} variant="outline">
            {loading ? "Loading..." : "▶  Open"}
          </Button>
        </form>
      </header>

      {error && (
        <div className="border-b border-red-500/40 bg-red-950 px-6 py-2.5 font-mono text-xs text-red-400">
          ✗ {error}
        </div>
      )}

      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <div
            ref={containerRef}
            className="h-full overflow-hidden flex flex-col items-center justify-center bg-slate-200 dark:bg-[#333]"
          >
            {/* {!pageData && !loading && <EmptyState />}
            {loading && <LoadingView />} */}

            {pageData && (
              <ScreenshotViewer
                screenshot={screenshot}
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
          <div className="p-4 space-y-3 overflow-y-auto h-full bg-white dark:bg-background">
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

            <Field>
              <FieldLabel>Chapter Title Selector (optional)</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  placeholder="h2.chapter"
                  className="min-h-auto"
                  value={selectors.chapter}
                  onChange={(e) =>
                    setSelectors({ ...selectors, chapter: e.target.value })
                  }
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => {
                      setOnSelectFn(() => {
                        return !onSelectFn
                          ? (el: any) => onPickSelector("chapter", el)
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
                <ImportTOCDialog
                  onImport={(chap) => setChapters((p) => [...p, ...chap])}
                >
                  <Button variant="outline" title="Import">
                    <ImportIcon />
                  </Button>
                </ImportTOCDialog>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => confirm("Are you sure?") && setChapters([])}
                >
                  <TrashIcon />
                </Button>
              </div>

              <div className="space-y-2 mt-2 max-h-55 overflow-y-auto">
                {chapters.map((chapter, idx) => (
                  <div className="flex items-center border-b">
                    <a
                      href={chapter.url}
                      onClick={(e) => {
                        e.preventDefault();
                        setUrl(chapter.url);
                        onLoad(chapter.url);
                      }}
                      target="_blank"
                      className="flex-1 truncate text-sm"
                    >
                      {chapter.title}
                    </a>
                    <Button variant="ghost" size="icon-sm">
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setChapters(chapters.filter((_, i) => i !== idx))
                      }
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <Field>
              <FieldLabel>Delay between chapters</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  placeholder="0"
                  value={delayChapter}
                  onChange={(e) => setDelayChapter(Number(e.target.value) || 0)}
                  type="number"
                />
                <InputGroupAddon align="inline-end">
                  <span>seconds</span>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <div className="flex items-center gap-2">
              <Button onClick={onPreview} variant="outline">
                <EyeIcon /> Preview
              </Button>
              <Button
                onClick={onDownload}
                disabled={!title || !selectors.content || !chapters.length}
              >
                <DownloadIcon /> Download
              </Button>
            </div>

            <Dialog
              open={contentPreview?.isVisible}
              onOpenChange={(open) =>
                !open
                  ? setContentPreview((prev) => ({
                      ...prev!,
                      isVisible: false,
                    }))
                  : null
              }
            >
              <DialogContent className="max-w-3xl!">
                <DialogHeader>
                  <DialogTitle>Content Preview</DialogTitle>
                </DialogHeader>

                {contentPreview && (
                  <>
                    {/* {contentPreview.chapter ? ( */}
                    <h2 className="text-md">
                      Chapter Title: {contentPreview.chapter || "-"}
                    </h2>
                    {/* ) : null} */}

                    <div
                      className="prose dark:prose-invert overflow-y-auto w-full max-w-max max-h-100 border p-4 rounded mt-1"
                      dangerouslySetInnerHTML={{
                        __html: contentPreview.content,
                      }}
                    />
                  </>
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

      <DownloadDialog
        open={!!downloadProgress}
        progress={downloadProgress?.progress}
        status={downloadProgress?.status}
      />
    </div>
  );
}

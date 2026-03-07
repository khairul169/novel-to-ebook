import React, { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "./ui/input-group";
import { Button } from "./ui/button";
import ScreenshotViewer from "./screenshot-viewer";
import { useMutation } from "@tanstack/react-query";
import { ofetch } from "ofetch";
import { Field, FieldLabel } from "./ui/field";
import { SquareDashedMousePointerIcon } from "lucide-react";
import * as cheerio from "cheerio";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { usePersistedState } from "@/hooks/use-persisted-state";

type Props = React.ComponentProps<typeof Dialog> & {
  onImport: (chapters: { title: string; url: string }[]) => void;
};

type PageData = {
  screenshot: string;
  elements: any[];
  url: string;
  pageSize: { width: number; height: number };
  html: string;
};

export default function ImportTOCDialog({
  children,
  onImport,
  ...props
}: Props) {
  const [url, setUrl] = usePersistedState("import-toc-dialog/url", "");
  const [linkSelector, setLinkSelector] = usePersistedState(
    "import-toc-dialog/link-selector",
    "",
  );
  const [titleSelector, setTitleSelector] = usePersistedState(
    "import-toc-dialog/title-selector",
    "",
  );
  const [isSelecting, setIsSelecting] = useState<"link" | "title" | false>(
    false,
  );
  const [chapters, setChapters] = useState<
    { title: string; url: string; checked: boolean }[]
  >([]);

  const {
    data: pageData,
    mutate: loadPage,
    isPending,
  } = useMutation({
    mutationFn: () => {
      let target = url;
      if (!/^https?:\/\//i.test(target)) target = "https://" + target;

      return ofetch<PageData>(`/api/screenshot`, {
        method: "POST",
        body: { url: target, isFullPage: true },
      });
    },
  });

  const onSelect = (el: any) => {
    if (isSelecting === "link") {
      setLinkSelector(el.selector);
    }
    if (isSelecting === "title") {
      let sel =
        linkSelector.length > 0
          ? el.selector
              .split(linkSelector.split(" ").pop()?.trim() || "")[1]
              ?.trim() || ""
          : el.selector;
      if (sel.startsWith(">")) sel = sel.slice(1).trim();
      setTitleSelector(sel);
    }

    setIsSelecting(false);
  };

  const onParse = () => {
    if (!pageData) return;

    const $ = cheerio.load(pageData.html);
    const res: { title: string; url: string; checked: boolean }[] = [];

    $(linkSelector).each((_, el) => {
      const $el = $(el);
      let title = $el.text().trim();
      let url = $el.attr("href") || "";

      if (titleSelector.length > 0) {
        const titleTxt = $el.find(titleSelector).text().trim();
        if (titleTxt.length > 0) title = titleTxt;
      }

      if (!url.startsWith("http")) url = new URL(pageData.url).origin + url;

      res.push({ title, url, checked: true });
    });

    setChapters(res);
  };

  const onToggleCheck = (idx: number, checked: boolean) => {
    setChapters((prev) => {
      const newChapters = [...prev];
      newChapters[idx] = {
        ...newChapters[idx],
        checked,
      };
      return newChapters;
    });
  };

  return (
    <Dialog {...props}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl!">
        <DialogHeader>
          <DialogTitle>Import Table of Contents</DialogTitle>
          <DialogDescription>
            You can import a table of contents from a page.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full overflow-hidden">
          <div className="flex items-center gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Insert TOC/chapters page url here..."
            />
            <Button onClick={() => loadPage()} disabled={isPending}>
              Open
            </Button>
          </div>

          <div className="flex items-stretch h-[70vh] mt-4 w-full gap-4">
            {pageData != null && (
              <>
                <div className="h-full flex-1 border rounded overflow-hidden">
                  <ScreenshotViewer
                    screenshot={pageData.screenshot}
                    elements={pageData.elements}
                    selectedSelector={null}
                    pageSize={pageData.pageSize}
                    isSelecting={isSelecting !== false}
                    onSelect={onSelect}
                    scale={0.9}
                    includeElements={isSelecting === "link" ? ["a"] : undefined}
                  />
                </div>
                <div className="w-[30%] h-full overflow-y-auto">
                  <Field>
                    <FieldLabel>Chapter Link Selector</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        placeholder="a.chapter-link"
                        className="min-h-auto"
                        value={linkSelector}
                        onChange={(e) => setLinkSelector(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          onClick={() =>
                            setIsSelecting(isSelecting ? false : "link")
                          }
                        >
                          <SquareDashedMousePointerIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Field className="mt-4">
                    <FieldLabel>Chapter Title Selector (optional)</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        className="min-h-auto"
                        value={titleSelector}
                        onChange={(e) => setTitleSelector(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          onClick={() =>
                            setIsSelecting(isSelecting ? false : "title")
                          }
                        >
                          <SquareDashedMousePointerIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Button
                    onClick={onParse}
                    disabled={!pageData}
                    className="mt-4"
                  >
                    Parse
                  </Button>

                  {chapters.length > 0 && (
                    <div className="space-y-2 mt-4 border p-4">
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          className="shrink-0 mt-0.5"
                          checked={chapters.every((c) => c.checked)}
                          onCheckedChange={(checked) =>
                            setChapters((prev) =>
                              prev.map((c) => ({
                                ...c,
                                checked: Boolean(checked),
                              })),
                            )
                          }
                        />
                        <span>Select All</span>
                      </label>

                      {chapters.map((c, idx) => (
                        <label
                          key={c.url}
                          className="flex items-start gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            className="shrink-0 mt-0.5"
                            checked={c.checked}
                            onCheckedChange={(checked) =>
                              onToggleCheck(idx, Boolean(checked))
                            }
                          />
                          <span>{c.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                disabled={!chapters.length}
                onClick={() => onImport?.(chapters.filter((c) => c.checked))}
              >
                Import
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

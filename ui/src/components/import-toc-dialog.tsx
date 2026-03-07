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
  InputGroupInput,
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
  const [url, setUrl] = useState("");
  const [chapterSelector, setChapterSelector] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [chapters, setChapters] = useState<{ title: string; url: string }[]>(
    [],
  );

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
    setIsSelecting(false);
    setChapterSelector(el.selector);
  };

  const onParse = () => {
    if (!pageData) return;

    const $ = cheerio.load(pageData.html);
    const res: { title: string; url: string }[] = [];
    $(chapterSelector).each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const url = $el.attr("href") || "";
      res.push({ title, url });
    });
    setChapters(res);
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
                    isSelecting={isSelecting}
                    onSelect={onSelect}
                    scale={0.9}
                    includeElements={["a"]}
                  />
                </div>
                <div className="w-[30%] h-full overflow-y-auto">
                  <Field>
                    <FieldLabel>Chapter Link Selector</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        placeholder="a.chapter-name"
                        className="min-h-auto"
                        value={chapterSelector}
                        onChange={(e) => setChapterSelector(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          onClick={() => setIsSelecting(!isSelecting)}
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
                    <ul className="space-y-3 mt-4 list-decimal pl-10 border p-4">
                      {chapters.map((c) => (
                        <li>
                          <a key={c.url} href={c.url} target="_blank">
                            {c.title}
                          </a>
                        </li>
                      ))}
                    </ul>
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
                onClick={() => onImport?.(chapters)}
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

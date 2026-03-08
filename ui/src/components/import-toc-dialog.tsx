import React, { useMemo, useState } from "react";
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
import { SearchIcon, SquareDashedMousePointerIcon, XIcon } from "lucide-react";
import * as cheerio from "cheerio";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import BrowserActionsInput, {
  type BrowserAction,
} from "./browser-actions-input";
import { searchChapters } from "@/lib/utils";

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
  const [browserActions, setBrowserActions] = usePersistedState<
    BrowserAction[]
  >("import-toc-dialog/browser-actions", []);
  const [onSelectFn, setSelectFn] = useState<((el: any) => void) | null>(null);
  const [selectType, setSelectType] = useState<"link" | "title" | null>(null);
  const [chapters, setChapters] = usePersistedState<
    { title: string; url: string; checked: boolean }[]
  >("import-toc-dialog/chapters", []);
  const [search, setSearch] = useState("");

  const filteredChapters = useMemo(() => {
    let items = chapters.map((i, idx) => ({ ...i, idx }));
    if (!search) return items;

    return searchChapters(items, (i) => i.title, search);
  }, [chapters, search]);

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
        body: {
          url: target,
          isFullPage: true,
          actions: browserActions.filter((i) => i.enabled),
        },
      });
    },
  });

  const onSelect = (type: "link" | "title", el: any) => {
    if (type === "link") {
      setLinkSelector(el.selector);
    }
    if (type === "title") {
      let sel =
        linkSelector.length > 0
          ? el.selector
              .split(linkSelector.split(" ").pop()?.trim() || "")[1]
              ?.trim() || ""
          : el.selector;
      if (sel.startsWith(">")) sel = sel.slice(1).trim();
      setTitleSelector(sel);
    }

    setSelectFn(null);
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

  const onToggleAll = (checked: boolean) => {
    setChapters((prev) => {
      const newVal = [...prev];
      filteredChapters.forEach((i) => (newVal[i.idx].checked = checked));
      return newVal;
    });
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
      <DialogContent className="md:max-w-[calc(100vw-4rem)]">
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

          <div className="flex items-stretch h-[calc(90vh-200px)] mt-4 w-full gap-4">
            <div className="h-full flex-1 border rounded overflow-hidden">
              {pageData != null && (
                <ScreenshotViewer
                  screenshot={pageData.screenshot}
                  elements={pageData.elements}
                  selectedSelector={null}
                  pageSize={pageData.pageSize}
                  isSelecting={onSelectFn != null}
                  onSelect={onSelectFn}
                  scale={0.9}
                  includeElements={selectType === "link" ? ["a"] : undefined}
                />
              )}
            </div>
            <div className="w-[30%] h-full overflow-y-auto">
              <Label>Actions</Label>
              <BrowserActionsInput
                className="mt-2"
                actions={browserActions}
                onChange={setBrowserActions}
                setSelectFn={(type, fn) => {
                  setSelectFn(onSelectFn ? null : () => fn);
                  setSelectType(type as never);
                }}
              />

              <Separator className="my-4" />

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
                      onClick={() => {
                        setSelectFn(
                          onSelectFn
                            ? null
                            : () => (el: any) => onSelect("link", el),
                        );
                        setSelectType("link");
                      }}
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
                      onClick={() => {
                        setSelectFn(
                          onSelectFn
                            ? null
                            : () => (el: any) => onSelect("title", el),
                        );
                        setSelectType("title");
                      }}
                    >
                      <SquareDashedMousePointerIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Button onClick={onParse} disabled={!pageData} className="mt-4">
                Parse
              </Button>

              <Separator className="my-4" />

              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search, eg: 25-50, >=50, <10, 100"
                />
                {search ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSearch("")}
                    >
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>

              {filteredChapters.length > 0 && (
                <div className="space-y-2 mt-4 border p-4">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      className="shrink-0 mt-0.5"
                      checked={filteredChapters.every((c) => c.checked)}
                      onCheckedChange={onToggleAll}
                    />
                    <span>Select All</span>
                  </label>

                  {filteredChapters.map((c) => (
                    <label
                      key={c.url}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        className="shrink-0 mt-0.5"
                        checked={c.checked}
                        onCheckedChange={(checked) =>
                          onToggleCheck(c.idx, Boolean(checked))
                        }
                      />
                      <span>{c.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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

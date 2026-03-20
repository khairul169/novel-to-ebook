import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createDisclosure } from "@/lib/store";
import ScreenshotViewer, {
  type ScreenshotViewerRef,
} from "./screenshot-viewer";
import { streamSSE } from "@/lib/sse";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export const customSelectorModal = createDisclosure<{
  url: string;
  onSelect: (selector: string) => void;
}>();

export default function CustomSelectorModal() {
  const disclosure = customSelectorModal.useStore();
  const { url, onSelect } = disclosure.data || {};

  const screenshotRef = useRef<ScreenshotViewerRef>(null!);

  const [curSelector, setSelector] = useState("");
  const [blockList, setBlockList] = useState<string[]>([]);

  const {
    data: pageData,
    mutate: loadPage,
    isPending,
  } = useMutation({
    mutationFn: async () => {
      let screenshot: string | null = null;
      let res: any = null;
      await streamSSE("/projects/snapshot", "post", {
        body: {
          url: url!,
          isFullPage: true,
          blockList,
        },
        onMessage: (event, data) => {
          if (event === "screenshot") {
            screenshot = data.img;
          }
          if (event === "result") {
            res = data;
          }
        },
      });
      return { ...res, screenshot } as {
        elements: any[];
        url: string;
        pageSize: { width: number; height: number };
        html: string;
        screenshot: string;
      };
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (url) {
      loadPage();
      setSelector("");
    }
  }, [url]);

  const onAddBlockList = () => {
    const hoveredEl = screenshotRef.current?.getHoveredElement();
    if (hoveredEl) {
      setBlockList([...blockList, hoveredEl.selector]);
      loadPage();
    }
  };

  return (
    <Dialog open={disclosure.open}>
      <DialogContent className="overflow-hidden md:max-w-[calc(100vw-4rem)]">
        <DialogHeader>
          <DialogTitle>Pick Content Selector</DialogTitle>
          <DialogDescription>
            Select a custom content selector to extract content from the page.
          </DialogDescription>
        </DialogHeader>

        <ContextMenu>
          <ContextMenuTrigger className="h-[calc(90vh-200px)] overflow-hidden">
            <ScreenshotViewer
              ref={screenshotRef}
              screenshot={pageData?.screenshot}
              elements={pageData?.elements}
              selectedSelector={curSelector}
              pageSize={pageData?.pageSize}
              isSelecting={
                disclosure.open && !isPending && pageData?.screenshot != null
              }
              onSelect={(el) => setSelector(el.selector)}
              disableDepthSelect
            />
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onClick={onAddBlockList}>
              Block Element
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DialogFooter>
          <Button
            onClick={() => {
              onSelect?.(curSelector);
              customSelectorModal.setOpen(false);
            }}
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

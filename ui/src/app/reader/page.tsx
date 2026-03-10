import { useEffect, useRef, useState } from "react";
import type { BookDoc, BookRelocate, FoliateView } from "./lib/types";
import { useSearchParams } from "react-router";
import { API_URL } from "@/lib/api";
import { getCSS, injectAdditionalLinks, type ReaderStyles } from "./lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export default function ReaderPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const viewRef = useRef<FoliateView | null>(null);
  const loadingRef = useRef(false);

  const [searchParams] = useSearchParams();
  const bookKey = searchParams.get("book") || "";
  const [curBook, setCurBook] = useState<BookDoc | null>(null);
  const [curState, setCurState] = useState<BookRelocate | null>(null);
  const [styles, _setStyles] = useState<ReaderStyles>({
    spacing: 1.6,
    justify: true,
    hyphenate: true,
    fontSize: 16 * 1.2,
  });

  const onDocLoad = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const doc = detail?.doc;

    if (doc) {
      injectAdditionalLinks(doc);

      doc.addEventListener("keydown", onKeyDown);
      doc.addEventListener("wheel", onWheel);
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!viewRef.current) return;
    if (e.deltaY < 0) viewRef.current.goLeft();
    else viewRef.current.goRight();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!viewRef.current) return;

    const k = event.key;
    if (k === "ArrowLeft" || k === "ArrowUp") viewRef.current.goLeft();
    else if (k === "ArrowRight" || k === "ArrowDown") viewRef.current.goRight();
  };

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("wheel", onWheel);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  const openDoc = async (file: File) => {
    if (viewRef.current) {
      viewRef.current.close();
      containerRef.current!.removeChild(viewRef.current);
      viewRef.current = null;
    } else {
      // @ts-ignore
      await import("@/lib/foliate-js/view.js");
    }

    const view = document.createElement("foliate-view") as FoliateView;
    view.style.width = "100%";
    view.style.height = "100%";
    view.style.display = "block";
    viewRef.current = view;
    containerRef.current.append(view);

    await view.open(file as unknown as BookDoc);
    view.addEventListener("load", onDocLoad);
    view.addEventListener("relocate", (e: any) => {
      setCurState(e.detail);
    });

    const { book } = view;
    setCurBook(book);
    view.renderer.setStyles?.(getCSS(styles));

    // enable pagination
    view.renderer.setAttribute("flow", "paginated");
    view.renderer.setAttribute("gap", "1%");
    view.renderer.setAttribute("max-inline-size", "720px");

    // enable animation
    view.renderer.setAttribute("animated", "true");

    // start render
    view.renderer.next();
  };

  useEffect(() => {
    const fetchBook = async () => {
      const res = await fetch(API_URL + "/library/get?key=" + bookKey);
      if (!res.ok) throw new Error(res.statusText);

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      const filename = disposition
        ? disposition.split("filename=")[1]?.replace(/"/g, "")
        : "book.epub";
      openDoc(new File([blob], filename));
    };

    if (!loadingRef.current) {
      loadingRef.current = true;
      fetchBook().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [bookKey]);

  useEffect(() => {
    // update styles
    viewRef.current?.renderer.setStyles?.(getCSS(styles));
  }, [styles]);

  return (
    <div className="bg-[#222] h-screen overflow-hidden flex flex-col items-stretch">
      <div className="px-2 py-1 text-white flex items-center gap-2">
        <Button variant="ghost" size="icon-lg" onClick={() => history.back()}>
          <ArrowLeftIcon />
        </Button>
        <p className="truncate max-w-2xl text-sm opacity-80">
          {curBook?.metadata?.title}
        </p>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
      <div className="px-4 h-10 flex items-center text-white">
        {curState && (
          <p className="text-right opacity-80 text-xs">{`${Math.round((curState?.location.current / curState?.location.total) * 100)}%`}</p>
        )}
        <div className="flex-1" />
        {curState && (
          <p className="text-right opacity-80 text-xs">{`${curState?.location.current} / ${curState?.location.total}`}</p>
        )}
      </div>
    </div>
  );
}

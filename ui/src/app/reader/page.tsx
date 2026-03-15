import { useEffect, useMemo, useRef, useState } from "react";
import type { BookDoc, BookRelocate, FoliateView } from "./lib/types";
import { useSearchParams } from "react-router";
import {
  getCSS,
  getHistory,
  injectAdditionalLinks,
  saveHistory,
  type ReaderStyles,
} from "./lib/utils";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/sidebar";
import { settingsStore } from "./lib/stores";
import { useStore } from "zustand";
import { appStore } from "@/stores/app.store";
import { getBookData } from "@/hooks/use-offline";
import type { OverlayRef } from "./components/overlay";
import Overlay from "./components/overlay";
import Footer from "./components/footer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ReaderPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const viewRef = useRef<FoliateView | null>(null);
  const loadingRef = useRef(false);
  const isRestoredRef = useRef(false);
  const overlayRef = useRef<OverlayRef>(null!);

  const [searchParams] = useSearchParams();
  const bookKey = searchParams.get("book") || "";
  const [curBook, setCurBook] = useState<BookDoc | null>(null);
  const [curState, setCurState] = useState<BookRelocate | null>(null);
  const theme = useStore(appStore, (i) => i.theme);
  const settings = useStore(settingsStore);

  const styles = useMemo<ReaderStyles>(
    () => ({
      ...settings.styles,
      colorScheme: theme as never,
    }),
    [theme, settings],
  );

  const onDocLoad = async (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const doc = detail?.doc;
    if (!doc) return;

    injectAdditionalLinks(doc);

    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("wheel", onWheel);

    overlayRef.current?.addDocListener(doc);
  };

  const onRelocate = async (e: Event, book: BookDoc) => {
    if (!isRestoredRef.current) return;

    const detail = (e as CustomEvent).detail;
    setCurState(detail);
    saveHistory(bookKey, {
      location: detail,
      name: book?.metadata?.title || bookKey.split("/").pop() || "",
      cover: "/library/cover.jpeg?key=" + encodeURIComponent(bookKey),
    });
  };

  const onWheel = (e: WheelEvent) => {
    const { flow } = settingsStore.getState();
    if (!viewRef.current || flow === "scrolled") return;

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
    containerRef.current?.addEventListener("wheel", onWheel);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      containerRef.current?.removeEventListener("wheel", onWheel);
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

    isRestoredRef.current = false;
    await view.open(file as unknown as BookDoc);

    try {
      console.log("Fetching read progress..");
      const progress = await getHistory(bookKey);
      const lastLocation = progress?.location;

      if (!lastLocation) {
        throw new Error("No read progress found");
      }

      view.init({ lastLocation: lastLocation.cfi });
      setCurState(lastLocation);
    } catch (err) {
      view.renderer.next();
      setCurState({ fraction: 0 } as never);
      console.error(err);
    } finally {
      setTimeout(() => {
        isRestoredRef.current = true;
      }, 1000);
    }

    view.addEventListener("load", onDocLoad);
    view.addEventListener("relocate", (e) => onRelocate(e, book));

    const { book } = view;
    setCurBook(book);
    view.renderer.setStyles?.(getCSS(styles));

    // enable pagination
    view.renderer.setAttribute("flow", settings.flow);
    view.renderer.setAttribute("gap", "2%");
    view.renderer.setAttribute("max-column-count", "2");
    view.renderer.setAttribute("max-inline-size", "920px");

    // enable animation
    view.renderer.setAttribute("animated", "true");
  };

  useEffect(() => {
    const fetchBook = async () => {
      const file = await getBookData(bookKey, (file) => {
        toast.info("Book file changed!", {
          action: <Button onClick={() => openDoc(file)}>Refresh</Button>,
        });
      });
      if (!file) throw new Error("Cannot find book file!");
      openDoc(file);
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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // reader settings
    view.renderer.setAttribute("flow", settings.flow);
  }, [settings]);

  return (
    <div className="bg-background h-screen-dvh overflow-hidden flex flex-row items-stretch relative">
      {!curState && (
        <div className="absolute inset-0 bg-background/60 text-foreground w-full h-full z-5 flex flex-col gap-2 items-center justify-center">
          <Loader2 className="animate-spin" size={32} />
          <span>Please wait...</span>
        </div>
      )}

      <Sidebar
        book={curBook}
        curState={curState}
        onTocClick={(href) => viewRef.current?.goTo(href)}
      />

      <div className="flex-1 flex flex-col items-stretch relative">
        <Overlay
          ref={overlayRef}
          curBook={curBook}
          curState={curState}
          containerRef={containerRef}
          viewRef={viewRef}
        />

        <div ref={containerRef} className="flex-1 overflow-hidden" />

        <Footer curBook={curBook} curState={curState} />
      </div>
    </div>
  );
}

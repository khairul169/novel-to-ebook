import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BookDoc, BookRelocate, FoliateView } from "./lib/types";
import { Link, useSearchParams } from "react-router";
import api, { API_URL } from "@/lib/api";
import { getCSS, injectAdditionalLinks, type ReaderStyles } from "./lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, MoonIcon, PanelLeftIcon, SunIcon, XIcon } from "lucide-react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import Sidebar from "./components/sidebar";
import { settingsStore, sidebarStore } from "./lib/stores";
import { useStore } from "zustand";
import { appStore, setAppTheme } from "@/stores/app.store";
import { useReaderTheme } from "./lib/hooks";

export default function ReaderPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const viewRef = useRef<FoliateView | null>(null);
  const loadingRef = useRef(false);
  const isRestoredRef = useRef(false);
  const headerRef = useRef<HeaderRef>(null!);

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
    headerRef.current?.addDocListener(doc);
  };

  const onRelocate = async (e: Event) => {
    if (!isRestoredRef.current) return;

    const detail = (e as CustomEvent).detail;
    setCurState(detail);
    console.log("store progress..", detail.fraction);
    api.PUT("/library/progress", {
      body: { key: bookKey, fraction: detail.fraction, location: detail },
    });
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

    isRestoredRef.current = false;
    await view.open(file as unknown as BookDoc);

    try {
      console.log("Fetching read progress..");
      const { data: progress } = await api.GET("/library/progress", {
        params: { query: { key: bookKey } },
      });
      const lastLocation: any = progress?.location;
      view.init({ lastLocation: lastLocation.cfi });
      setCurState(lastLocation);
    } catch (err) {
      setCurState({ fraction: 0 } as never);
      console.error(err);
    } finally {
      setTimeout(() => {
        isRestoredRef.current = true;
      }, 1000);
    }

    view.addEventListener("load", onDocLoad);
    view.addEventListener("relocate", onRelocate);

    const { book } = view;
    setCurBook(book);
    view.renderer.setStyles?.(getCSS(styles));

    // enable pagination
    view.renderer.setAttribute("flow", "paginated");
    view.renderer.setAttribute("gap", "5%");
    view.renderer.setAttribute("max-inline-size", "720px");

    // enable animation
    view.renderer.setAttribute("animated", "true");

    // start render
    // view.renderer.next();
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
    <div className="bg-background h-screen-dvh overflow-hidden flex flex-row items-stretch relative">
      {!curState && (
        <div className="absolute inset-0 bg-black/80 w-full h-full z-5 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      <Sidebar
        book={curBook}
        curState={curState}
        onTocClick={(href) => viewRef.current?.goTo(href)}
      />

      <div className="flex-1 flex flex-col items-stretch relative">
        <Header ref={headerRef} curBook={curBook} />

        <div ref={containerRef} className="flex-1 overflow-hidden" />

        <div
          className="px-6 pb-4 flex items-center text-foreground/60 gap-4 text-xs hover:text-foreground/80 transition-colors"
          style={{
            background: settings.styles.theme?.[theme]?.background,
            color: settings.styles.theme?.[theme]?.color,
          }}
        >
          <p className="truncate max-w-2xl text-sm">
            {curState?.tocItem?.label || curBook?.metadata?.title || ""}
          </p>
          <div className="flex-1" />
          <Time />
          <span>&middot;</span>
          {curState && (
            <p className="text-right">{`${curState?.location.current} / ${curState?.location.total} (${Math.round((curState?.location.current / curState?.location.total) * 100)}%)`}</p>
          )}
        </div>
      </div>
    </div>
  );
}

type HeaderRef = { addDocListener(doc: Document): () => void };

const Header = ({
  curBook,
  ref,
}: {
  curBook?: BookDoc | null;
  ref?: React.Ref<HeaderRef>;
}) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [isVisible, setVisible] = useState(false);
  const [isSticky, setSticky] = useState(false);
  const theme = useStore(appStore, (i) => i.theme);
  const readerTheme = useReaderTheme();

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const w = window.innerWidth * 0.3;
    const startX = (window.innerWidth - w) * 0.5;
    const offset = touch.clientX - (touchStart.current?.x || 0);
    touchStart.current = null;

    if (Math.abs(offset) > 5) return;

    if (touch.clientX >= startX && touch.clientX <= startX + w) {
      setSticky((s) => !s);
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isSticky) return;
      setVisible(e.clientY < 100);
    },
    [isSticky],
  );

  const addDocListener = useCallback(
    (doc: Document) => {
      doc.addEventListener("mousemove", onMouseMove);
      doc.addEventListener("touchstart", onTouchStart);
      doc.addEventListener("touchend", onTouchEnd);

      return () => {
        doc.removeEventListener("mousemove", onMouseMove);
        doc.removeEventListener("touchstart", onTouchStart);
        doc.removeEventListener("touchend", onTouchEnd);
      };
    },
    [onMouseMove, onTouchStart, onTouchEnd],
  );

  useEffect(() => {
    return addDocListener(window as never);
  }, [addDocListener]);

  useImperativeHandle(ref, () => ({ addDocListener }), [addDocListener]);

  return (
    <div
      className={cn(
        "absolute top-0 left-0 w-full z-8 px-3 h-14 text-foreground flex items-center gap-2 bg-background transition-all -translate-y-full opacity-0",
        isSticky || isVisible ? "translate-y-0 opacity-100" : "",
      )}
      style={{
        background: readerTheme.background,
        color: readerTheme.color,
      }}
    >
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() =>
          sidebarStore.setState((s) => ({ isVisible: !s.isVisible }))
        }
      >
        <PanelLeftIcon />
      </Button>
      <p className="truncate max-w-2xl text-sm opacity-80">
        {curBook?.metadata?.title}
      </p>
      <div className="flex-1" />
      <Button
        variant="ghost"
        className="rounded-full"
        size="icon-lg"
        onClick={() => setAppTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
      <Button
        asChild
        variant="secondary"
        className="rounded-full"
        size="icon-lg"
      >
        <Link to="/" replace>
          <XIcon />
        </Link>
      </Button>
    </div>
  );
};

const Time = () => {
  const [time, setTime] = useState(dayjs().format("HH:mm"));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().format("HH:mm"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <p>{time}</p>;
};

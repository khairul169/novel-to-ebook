import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BookDoc, BookRelocate, FoliateView } from "../lib/types";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoonIcon,
  PanelLeftIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarStore } from "../lib/stores";
import { useStore } from "zustand";
import { appStore, setAppTheme } from "@/stores/app.store";
import { useReaderTheme } from "../lib/hooks";
import BackButton from "@/components/ui/back-button";
import SettingsModal from "./settings-modal";
import { Slider } from "@/components/ui/slider";
import { useDebounceFn } from "@/hooks/use-debounce";

export type OverlayRef = { addDocListener(doc: Document): () => void };

export default function Overlay({
  curBook,
  ref,
  curState,
  containerRef,
  viewRef,
}: {
  curBook?: BookDoc | null;
  ref?: React.Ref<OverlayRef>;
  curState?: BookRelocate | null;
  containerRef?: React.RefObject<HTMLDivElement>;
  viewRef?: React.RefObject<FoliateView | null>;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const theme = useStore(appStore, (i) => i.theme);
  const readerTheme = useReaderTheme();

  const [isVisible, setVisible] = useState(false);
  const [isSticky, setSticky] = useState(false);

  const location = curState?.location || { current: 0, total: 1, next: 0 };

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current = {
      x: e.changedTouches[0].screenX,
      y: e.changedTouches[0].screenY,
    };
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    // const width = window.outerWidth;
    // const ratio = touch.screenX / width;
    const start = touchStart.current || { x: 0, y: 0 };
    touchStart.current = null;

    // ignore swipe
    if (
      Math.abs(touch.screenX - start.x) > 10 ||
      Math.abs(touch.screenY - start.y) > 10
    )
      return;

    // if (ratio < 0.25) {
    //   // reader.prev();
    // } else if (ratio > 0.75) {
    //   // reader.next();
    // } else {
    // center tap
    setSticky((s) => !s);
    // }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isSticky) return;
      setVisible(e.clientY < 100 || e.clientY > window.innerHeight - 100);
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

  const setProgress = useDebounceFn((progress: number) => {
    viewRef?.current?.goToFraction(progress);
  }, 500);

  const navigateTo = (to: "left" | "right" | "prev" | "next") => {
    const view = viewRef?.current;
    if (!view) return;

    switch (to) {
      case "left":
        return view.prev();
      case "right":
        return view.next();
      case "prev":
        return view.renderer.prevSection?.();
      case "next":
        return view.renderer.nextSection?.();
    }
  };

  useEffect(() => {
    return addDocListener(containerRef?.current as never);
  }, [addDocListener]);

  useImperativeHandle(ref, () => ({ addDocListener }), [addDocListener]);

  return (
    <>
      <div
        className={cn(
          "absolute top-0 left-0 w-full z-8 px-3 h-14 text-foreground flex items-center gap-2 bg-background transition-all -translate-y-full opacity-0",
          isSticky || isVisible ? "translate-y-0 opacity-100" : "",
        )}
        style={{ background: readerTheme.background, color: readerTheme.color }}
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

        <SettingsModal />

        <Button
          variant="ghost"
          className="rounded-full"
          size="icon-lg"
          onClick={() => setAppTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>

        <BackButton
          to="/"
          variant="secondary"
          className="rounded-full"
          size="icon-lg"
        >
          <XIcon />
        </BackButton>
      </div>

      <div
        className={cn(
          "absolute bottom-0 left-0 w-full z-8 px-3 pt-4 pb-6 text-foreground flex items-center gap-2 bg-background transition-all translate-y-full opacity-0",
          isSticky || isVisible ? "translate-y-0 opacity-100" : "",
        )}
        style={{ background: readerTheme.background, color: readerTheme.color }}
      >
        <Button variant="ghost" onClick={() => navigateTo("prev")}>
          <ChevronsLeftIcon />
        </Button>
        <Button variant="ghost" onClick={() => navigateTo("left")}>
          <ChevronLeftIcon />
        </Button>
        <p className="text-center text-xs mr-2">{`${location.current} / ${location.total}`}</p>
        <div className="flex-1">
          <ProgressSlider location={location} setProgress={setProgress} />
        </div>
        <Button variant="ghost" onClick={() => navigateTo("right")}>
          <ChevronRightIcon />
        </Button>
        <Button variant="ghost" onClick={() => navigateTo("next")}>
          <ChevronsRightIcon />
        </Button>
      </div>
    </>
  );
}

function ProgressSlider({
  location,
  setProgress,
}: {
  location: BookRelocate["location"];
  setProgress: (progress: number) => void;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(location.current);
  }, [location.current]);

  return (
    <Slider
      value={[value]}
      max={location.total}
      step={1}
      className="w-full"
      onValueChange={(e) => {
        setValue(e[0]);
        setProgress(e[0] / location.total);
      }}
    />
  );
}

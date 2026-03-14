import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BookDoc } from "../lib/types";
import { Button } from "@/components/ui/button";
import { MoonIcon, PanelLeftIcon, SunIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarStore } from "../lib/stores";
import { useStore } from "zustand";
import { appStore, setAppTheme } from "@/stores/app.store";
import { useReaderTheme } from "../lib/hooks";
import BackButton from "@/components/ui/back-button";
import SettingsModal from "./settings-modal";

export type HeaderRef = { addDocListener(doc: Document): () => void };

export default function Header({
  curBook,
  ref,
}: {
  curBook?: BookDoc | null;
  ref?: React.Ref<HeaderRef>;
}) {
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
  );
}

import { useEffect, useMemo, useRef } from "react";
import { closeTab, tabStore, useTabStore } from "../lib/stores";
import { cn } from "@/lib/utils";
import BackButton from "@/components/ui/back-button";
import { XIcon } from "lucide-react";

export default function MainTabs() {
  const { tabs, curTab } = useTabStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tab = document.getElementById(curTab);
    if (!tab) return;

    tab.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [curTab]);

  const tab = useMemo(() => {
    return tabs.find((tab) => tab.href === curTab);
  }, [curTab]);

  return (
    <div className="flex-1 flex flex-col items-stretch overflow-hidden">
      <div className="flex items-center overflow-hidden border-b min-h-12">
        <div
          ref={containerRef}
          className="flex items-center flex-1 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <div
              key={tab.href}
              id={tab.href}
              className={cn(
                "group flex items-stretch mt-[calc(0.5rem-1px)]",
                tab.href === curTab && "bg-primary/10",
              )}
            >
              <button
                key={tab.href}
                className="px-4 h-10 pr-0 text-xs shrink-0 cursor-pointer max-w-sm truncate"
                onClick={() => tabStore.setState({ curTab: tab.href })}
              >
                {tab.title}
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 cursor-pointer px-2 hover:bg-primary/10"
                onClick={() => closeTab(tab.href)}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <BackButton
          to="/projects"
          variant="outline"
          size="icon-xs"
          className="shrink-0 mx-2"
        >
          <XIcon />
        </BackButton>
      </div>

      {tab?.element}
    </div>
  );
}

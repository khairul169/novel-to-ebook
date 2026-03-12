import { useMemo } from "react";
import { tabStore, useTabStore } from "../lib/stores";
import { cn } from "@/lib/utils";

export default function MainTabs() {
  const { tabs, curTab } = useTabStore();

  const tab = useMemo(() => {
    return tabs.find((tab) => tab.href === curTab);
  }, [curTab]);

  if (!tabs.length) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col items-stretch overflow-hidden">
      <div className="flex items-center overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.href}
            className={cn(
              "px-4 py-2 text-sm shrink-0 cursor-pointer max-w-sm truncate",
              tab.href === curTab && "bg-primary/10",
            )}
            onClick={() => tabStore.setState({ curTab: tab.href })}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {tab?.element}
    </div>
  );
}

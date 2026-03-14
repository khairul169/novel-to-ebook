import { useEffect, useState } from "react";
import type { BookDoc, BookRelocate } from "../lib/types";
import { useReaderTheme } from "../lib/hooks";
import dayjs from "dayjs";
import { ClockIcon } from "lucide-react";

type Props = {
  curBook?: BookDoc | null;
  curState?: BookRelocate | null;
};

export default function Footer({ curBook, curState }: Props) {
  const theme = useReaderTheme();

  return (
    <div
      className="px-6 md:px-3 pb-4 flex items-center text-foreground/60 gap-2 md:gap-4 text-xs hover:text-foreground/80 transition-colors"
      style={{ background: theme.background }}
    >
      <p className="truncate max-w-2xl text-sm hidden sm:block">
        {curState?.tocItem?.label || curBook?.metadata?.title || ""}
      </p>
      <div className="flex-1 hidden sm:block" />
      <Time />
      <span>&middot;</span>
      {curState?.location && (
        <p className="text-right">{`${curState?.location.current} / ${curState?.location.total} (${(curState?.fraction * 100).toFixed(1)}%)`}</p>
      )}
    </div>
  );
}

function Time() {
  const [time, setTime] = useState(dayjs().format("HH:mm"));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().format("HH:mm"));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p>
      <ClockIcon className="inline mr-1" size={14} />
      {time}
    </p>
  );
}

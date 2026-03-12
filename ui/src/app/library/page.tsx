import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { API_URL } from "@/lib/api";
import { ArrowLeftIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getLibraryTitle } from "./lib/utils";
import { cn } from "@/lib/utils";
import { useOfflineApiQuery } from "@/hooks/use-offline";
import OfflineImage from "@/components/offline-image";
import { useHistories } from "./lib/hooks";
import type { BookRelocate } from "../reader/lib/types";

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const { data: history } = useHistories();
  const { data: books } = useOfflineApiQuery("get", "/library");
  const [searchParams] = useSearchParams();
  const baseDir = searchParams.get("dir") || "";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-2 p-6 pb-0">
        <InputGroup className="w-full max-w-3xl">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <div className="flex-1" />
        <Button asChild>
          <Link to="/projects">
            <PlusIcon /> Create
          </Link>
        </Button>
      </div>

      {!search && !baseDir && history && history.length > 0 && (
        <>
          <h2 className="font-medium text-xl mx-6 mt-10">Continue Reading</h2>
          <LibraryList items={history} />
        </>
      )}

      {search || baseDir ? (
        <Button
          asChild
          variant="ghost"
          className="ml-2 mt-6"
          onClick={() => setSearch("")}
        >
          <Link to="/">
            <ArrowLeftIcon className="size-6" />
          </Link>
        </Button>
      ) : null}

      <h2
        className={cn(
          "font-medium text-xl mx-6 mt-10",
          search || baseDir ? "text-3xl mt-2" : "",
        )}
      >
        {getLibraryTitle({ search, baseDir })}
      </h2>
      <LibraryList items={books} search={search} baseDir={baseDir} />
    </div>
  );
}

type LibraryItem = {
  key: string;
  location?: BookRelocate;
  name?: string;
  metadata?: any;
  cover?: string | null;
  parent?: string | null;
  isDirectory?: boolean;
};

const LibraryList = ({
  items,
  search,
  baseDir,
}: {
  items?: LibraryItem[];
  search?: string | null;
  baseDir?: string | null;
}) => {
  const filtered = useMemo(() => {
    let res = items || [];
    if (baseDir !== null) {
      res = res.filter((i) => i.parent === baseDir);
    }
    if (search) {
      res = res.filter((i) =>
        i.name?.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return res;
  }, [items, search, baseDir]);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] p-2">
      {filtered?.map((item) => (
        <Link
          key={item.key}
          to={
            item.isDirectory
              ? `/?dir=${item.key}`
              : `/reader/?book=${encodeURI(item.key)}`
          }
          className="text-foreground p-4 hover:bg-secondary"
          title={item.metadata?.title || item.name}
        >
          <div className="w-full aspect-3/4 bg-background relative overflow-hidden">
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
              <p className="text-md line-clamp-3">
                {item.metadata?.title || item.name}
              </p>
              <p className="text-sm mt-2 opacity-50">
                {item.metadata?.creator}
              </p>
            </div>

            <OfflineImage
              src={item.cover ? API_URL + item.cover : null}
              alt={item.name}
              className="absolute z-1 inset-0 w-full h-full object-cover rounded overflow-hidden shadow"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            {item.location?.fraction && (
              <div className="absolute z-2 bottom-0 left-0 w-full bg-background/20 flex items-center justify-between">
                <div
                  className="bg-green-500 h-0.75"
                  style={{ width: `${item.location.fraction * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="line-clamp-2 mt-2 text-xs font-medium">
            {item.metadata?.title || item.name}
          </div>
        </Link>
      ))}
    </div>
  );
};

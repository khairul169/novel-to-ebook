import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { $api, API_URL } from "@/lib/api";
import { ScanTextIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const { data: history } = $api.useQuery("get", "/library/history");
  const { data: books } = $api.useQuery("get", "/library");

  const items = useMemo(() => {
    if (search) {
      return books?.filter((b) =>
        b.name?.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return books;
  }, [books, search]);

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
          <Link to="/extract">
            <ScanTextIcon /> Extract
          </Link>
        </Button>
      </div>

      {!search && history && history.length > 0 && (
        <>
          <h2 className="font-medium text-xl mx-6 mt-10">Continue Reading</h2>
          <LibraryList books={history} />
        </>
      )}

      <h2 className="font-medium text-xl mx-6 mt-10">Your Library</h2>
      <LibraryList books={items} />
    </div>
  );
}

type Book = {
  key: string;
  fraction?: number;
  name?: string;
  metadata?: any;
};

const LibraryList = ({ books }: { books?: Book[] }) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] p-2">
      {books?.map((book) => (
        <a
          key={book.key}
          href={`/reader/?book=${encodeURI(book.key)}`}
          className="text-foreground p-4 hover:bg-secondary"
        >
          <div className="w-full aspect-3/4 bg-background relative overflow-hidden">
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
              <p className="text-md line-clamp-3">
                {book.metadata?.title || book.name}
              </p>
              <p className="text-sm mt-2 opacity-50">
                {book.metadata?.creator}
              </p>
            </div>

            <img
              src={`${API_URL}/library/cover.jpeg?key=${book.key}`}
              alt={book.name}
              className="absolute z-1 inset-0 w-full h-full object-cover rounded overflow-hidden shadow"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            {book.fraction && (
              <div className="absolute z-2 bottom-0 left-0 w-full bg-background/20 flex items-center justify-between">
                <div
                  className="bg-green-500 h-0.75"
                  style={{ width: `${book.fraction * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="line-clamp-2 mt-2 text-xs font-medium">
            {book.metadata?.title || book.name}
          </div>
        </a>
      ))}
    </div>
  );
};

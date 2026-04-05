import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListIcon } from "lucide-react";
import type { LibraryView } from "./library-list";

type Props = {
  view?: LibraryView;
  onChange: (values: Partial<LibraryView>) => void;
};

export default function LibraryViewMenu({ view, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <ListIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>View Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={view?.mode}
            defaultValue="grid"
            onValueChange={(e) => onChange({ mode: e as never })}
          >
            <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort By</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={view?.orderBy}
            defaultValue="name"
            onValueChange={(e) => onChange({ orderBy: e as never })}
          >
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created">
              Created
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="modified">
              Modified
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="readAt">
              Last Read
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup
            value={view?.sort === -1 ? "desc" : "asc"}
            defaultValue="asc"
            onValueChange={(e) => onChange({ sort: e === "asc" ? 1 : -1 })}
          >
            <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

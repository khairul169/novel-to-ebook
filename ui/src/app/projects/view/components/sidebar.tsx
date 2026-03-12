import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import {
  BookTextIcon,
  FileIcon,
  FilePlusCornerIcon,
  ListOrderedIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useProjectContext } from "../lib/context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectDetailsSchema } from "../lib/schema";
import { useDeleteChapter, useUpdateProject } from "../lib/hooks";
import { toast } from "sonner";
import { addChapterModal } from "./add-chapter-modal";
import { $api } from "@/lib/api";
import { openTab } from "../lib/stores";
import ChapterEditor from "./chapter-editor";

const tabs = [
  {
    id: "toc",
    name: "Table of Contents",
    icon: ListOrderedIcon,
    Component: TableOfContents,
  },
  {
    id: "details",
    name: "Project Details",
    icon: BookTextIcon,
    Component: ProjectDetails,
  },
];

export default function Sidebar() {
  const [curTab, setTab] = usePersistedState(
    "projects/sidebar-tab",
    tabs[0].id,
  );

  const tab = useMemo(() => {
    const item = tabs.find((tab) => tab.id === curTab);
    if (!item) return null;

    const Comp = item.Component;
    const element = Comp ? <Comp /> : null;
    return { ...item, Component: undefined, element };
  }, [curTab]);

  return (
    <>
      <nav className="w-12 bg-secondary border-r">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            className={cn(
              "w-full aspect-square h-auto rounded-none border-b",
              curTab === tab.id && "bg-primary/10",
            )}
            onClick={() => setTab(tab.id)}
          >
            <tab.icon />
          </Button>
        ))}
      </nav>
      <aside className="w-65 bg-background border-r flex flex-col items-stretch">
        <div className="px-4 py-3">
          <p className="text-xs uppercase truncate">{tab?.name || ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto pb-3">{tab?.element}</div>
      </aside>
    </>
  );
}

function TableOfContents() {
  const { project } = useProjectContext();
  const { data: chapters } = $api.useQuery(
    "get",
    "/projects/{projectId}/chapters",
    { params: { path: { projectId: project.id } } },
  );
  const deleteChapter = useDeleteChapter(project.id);

  const onDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this chapter?")) return;
    deleteChapter(id);
  };

  return (
    <div>
      <Button
        variant="ghost"
        size="xs"
        className="mx-2"
        onClick={() => addChapterModal.onOpen()}
      >
        <FilePlusCornerIcon />
        Add Chapter
      </Button>

      <div className="border-t mt-2 flex flex-col items-stretch py-1">
        {!chapters && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <FileIcon className="size-8" />
            <p className="text-center text-sm">No Chapter Added</p>
          </div>
        )}

        {chapters?.map((c) => (
          <div
            key={c.id}
            className="flex items-center hover:bg-primary/10 transition-colors group"
          >
            <button
              className="px-4 h-8 cursor-pointer flex-1 text-left truncate text-xs"
              onClick={() =>
                openTab({
                  href: "chapter/" + c.id,
                  title: c.title,
                  element: <ChapterEditor id={c.id} />,
                })
              }
            >
              {c.title}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none hidden group-hover:flex"
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none hidden group-hover:flex"
              onClick={() => onDelete(c.id)}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDetails() {
  const { project } = useProjectContext();
  const form = useForm({ resolver: zodResolver(projectDetailsSchema) });
  const update = useUpdateProject(project.id);

  useEffect(() => {
    try {
      form.reset(projectDetailsSchema.parse(project));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [project.id]);

  useEffect(() => {
    const cb = form.watch((data) => update.debounce(data));
    return () => cb.unsubscribe();
  }, []);

  return (
    <div className="px-4 space-y-3">
      <Field>
        <FieldLabel>Title</FieldLabel>
        <InputGroup>
          <InputGroupInput placeholder="Untitled" {...form.register("title")} />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Author</FieldLabel>
        <InputGroup>
          <InputGroupInput
            placeholder="Anonymous"
            {...form.register("author")}
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Cover</FieldLabel>
        <InputGroup>
          <InputGroupInput placeholder="https://" {...form.register("cover")} />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Language</FieldLabel>
        <InputGroup>
          <InputGroupInput placeholder="en" {...form.register("language")} />
        </InputGroup>
      </Field>
    </div>
  );
}

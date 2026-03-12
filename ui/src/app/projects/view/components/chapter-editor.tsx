import { $api, invalidateQuery, type JsonBody } from "@/lib/api";
import { useProjectContext } from "../lib/context";
import { useEffect } from "react";
import { toast } from "sonner";
import { MinimalTiptapEditor } from "@/components/ui/minimal-tiptap";
import useMinimalTiptapEditor from "@/components/ui/minimal-tiptap/hooks/use-minimal-tiptap";
import { useStore } from "zustand";
import { tabStore } from "../lib/stores";

type Props = {
  id: string;
};

export default function ChapterEditor({ id }: Props) {
  const { project } = useProjectContext();
  const curTab = useStore(tabStore, (i) => i.curTab);

  const { data: chapter } = $api.useQuery(
    "get",
    "/projects/{projectId}/chapters/{id}",
    { params: { path: { projectId: project.id, id } } },
  );
  const updateMutation = $api.useMutation(
    "put",
    "/projects/{projectId}/chapters/{id}",
  );

  const update = (
    values: JsonBody<"/projects/{projectId}/chapters/{id}", "put">,
  ) => {
    updateMutation.mutate(
      {
        params: { path: { projectId: project.id, id } },
        body: values,
      },
      {
        onSuccess() {
          invalidateQuery("/projects/{projectId}/chapters");
        },
        onError(err) {
          toast.error((err as Error).message);
        },
      },
    );
  };

  const editor = useMinimalTiptapEditor({
    onUpdate: (e) => update({ content: e as string }),
    throttleDelay: 3000,
    autofocus: true,
    editable: true,
    editorClassName: "focus:outline-hidden min-h-[500px] pb-32",
    output: "html",
    placeholder: "...",
  });

  useEffect(() => {
    if (chapter?.id) {
      editor?.commands.setContent(chapter.content || "");
      editor?.commands.focus();
    }
  }, [id, curTab, chapter?.id]);

  return (
    <MinimalTiptapEditor
      editor={editor}
      className="w-full flex-1 flex-col overflow-hidden ring-0! border-0!"
      editorContentClassName="p-8 flex-1 overflow-auto"
    />
  );
}

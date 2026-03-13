import api, { $api, invalidateQuery, type JsonBody } from "@/lib/api";
import { useProjectContext } from "../lib/context";
import { useEffect } from "react";
import { toast } from "sonner";
import { MinimalTiptapEditor } from "@/components/ui/minimal-tiptap";
import useMinimalTiptapEditor from "@/components/ui/minimal-tiptap/hooks/use-minimal-tiptap";

type Props = {
  id: number;
};

export default function ChapterEditor({ id }: Props) {
  const { project } = useProjectContext();
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
    editable: true,
    editorClassName:
      "focus:outline-hidden min-h-[500px] pb-32 max-w-5xl! mx-auto",
    output: "html",
    placeholder: "Insert content here...",
  });

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const { data: chapter } = await api.GET(
          "/projects/{projectId}/chapters/{id}",
          { params: { path: { projectId: project.id, id } } },
        );
        editor?.commands.setContent(chapter?.content || "", {
          emitUpdate: false,
        });
        editor?.commands.focus("start");
      } catch (err) {
        toast.error((err as Error).message);
      }
    };

    fetchChapter();
  }, [id, editor]);

  return (
    <MinimalTiptapEditor
      editor={editor}
      className="flex-1 flex-col overflow-hidden ring-0! border-0!"
      editorContentClassName="p-8 flex-1 overflow-auto"
    />
  );
}

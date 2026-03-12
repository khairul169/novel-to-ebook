import { $api, invalidateQuery, type JsonBody } from "@/lib/api";
import { useProjectContext } from "../lib/context";
import { useDebounceFn } from "@/hooks/use-debounce";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Props = {
  id: string;
};

export default function ChapterEditor({ id }: Props) {
  const { project } = useProjectContext();
  const inputRef = useRef<HTMLTextAreaElement>(null!);

  const { data: chapter } = $api.useQuery(
    "get",
    "/projects/{projectId}/chapters/{id}",
    { params: { path: { projectId: project.id, id } } },
  );
  const updateMutation = $api.useMutation(
    "put",
    "/projects/{projectId}/chapters/{id}",
  );

  const update = useDebounceFn(
    (values: JsonBody<"/projects/{projectId}/chapters/{id}", "put">) =>
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
      ),
    500,
  );

  useEffect(() => {
    if (id) {
      inputRef.current.focus();
      inputRef.current.value = chapter?.content || "";
    }
  }, [id, chapter?.content]);

  return (
    <textarea
      ref={inputRef}
      className="w-full flex-1 outline-0 p-4"
      onChange={(e) => update({ content: e.target.value })}
    />
  );
}

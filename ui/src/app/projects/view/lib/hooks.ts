import { useDebounceFn } from "@/hooks/use-debounce";
import { $api, invalidateQuery, type JsonBody } from "@/lib/api";
import { useCallback } from "react";
import { toast } from "sonner";

export function useUpdateProject(id: string) {
  const update = $api.useMutation("put", "/projects/{id}");
  const mutate = useCallback(
    (values: JsonBody<"/projects/{id}", "put">) => {
      update.mutate({ params: { path: { id } }, body: values });
    },
    [id],
  );
  const debounce = useDebounceFn(mutate, 500);
  return { mutate, debounce } as const;
}

export function useDeleteChapter(projectId: string) {
  const deleteChapter = $api.useMutation(
    "delete",
    "/projects/{projectId}/chapters/{id}",
  );
  return useCallback((id: string) => {
    deleteChapter.mutate(
      { params: { path: { projectId, id } } },
      {
        onSuccess() {
          invalidateQuery("/projects/{projectId}/chapters");
          toast.success("Chapter deleted");
        },
        onError(err) {
          toast.error((err as Error).message);
        },
      },
    );
  }, []);
}

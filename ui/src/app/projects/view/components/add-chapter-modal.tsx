import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import api, { $api, invalidateQuery, type JsonBody } from "@/lib/api";
import { createDisclosure } from "@/lib/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookSearchIcon, LinkIcon, NotebookPenIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import { useProjectContext } from "../lib/context";
import { toast } from "sonner";

export const addChapterModal = createDisclosure();

const schema = z.union([
  z.object({
    type: z.literal("empty"),
    title: z.string().min(1),
  }),
  z.object({
    type: z.literal("link"),
    url: z.url().min(1),
  }),
  z.object({ type: z.null() }),
]);

type CreateChapterBody = JsonBody<"/projects/{projectId}/chapters", "post">;

export default function AddChapterModal() {
  const { project } = useProjectContext();
  const { open } = addChapterModal.useStore();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: null },
  });
  const type = useWatch({ control: form.control, name: "type" });

  const create = $api.useMutation("post", "/projects/{projectId}/chapters", {
    onSuccess() {
      addChapterModal.setOpen(false);
      invalidateQuery("/projects/{projectId}/chapters");
    },
    onError(err) {
      toast.error((err as Error).message);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    const body: CreateChapterBody = { title: "", content: "", index: 0 };

    try {
      if (values.type === "empty") {
        body.title = values.title;
      }

      if (values.type === "link") {
        const { data } = await api.POST("/projects/extract", {
          body: { url: values.url! },
        });

        if (!data?.content) {
          throw new Error("No content!");
        }

        body.title = data.chapter || data.title;
        body.content = data.content;
      }

      create.mutate({ params: { path: { projectId: project.id } }, body });
    } catch (err) {
      toast.error((err as Error).message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={addChapterModal.setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Chapter</DialogTitle>
          <DialogDescription>
            Select type and add new chapter to the book
          </DialogDescription>
        </DialogHeader>

        {!type ? (
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="flex-col h-24"
              onClick={() => form.setValue("type", "empty")}
            >
              <NotebookPenIcon />
              Empty
            </Button>
            <Button
              variant="outline"
              className="flex-col h-24"
              onClick={() => form.setValue("type", "link")}
            >
              <LinkIcon />
              Link
            </Button>
            <Button variant="outline" className="flex-col h-24" disabled>
              <BookSearchIcon />
              Multi Link
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            {type === "empty" && (
              <div className="space-y-3">
                <Field>
                  <FieldLabel>Title</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      autoFocus
                      placeholder="Untitled"
                      {...form.register("title")}
                    />
                  </InputGroup>
                </Field>
              </div>
            )}

            {type === "link" && (
              <div className="space-y-3">
                <Field>
                  <FieldLabel>URL</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      autoFocus
                      placeholder="https://"
                      {...form.register("url")}
                    />
                  </InputGroup>
                </Field>
              </div>
            )}

            {type != null && (
              <DialogFooter className="mt-4">
                <Button type="submit">Save</Button>
              </DialogFooter>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

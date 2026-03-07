import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Field, FieldLabel } from "./ui/field";

type Props = React.ComponentProps<typeof Dialog> & {
  status?: string | null;
  progress?: number;
};

export default function DownloadDialog({ status, progress, ...props }: Props) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Downloading Book</DialogTitle>
          <DialogDescription>
            Please wait until download is complete...
          </DialogDescription>
        </DialogHeader>

        <Field className="w-full">
          <FieldLabel>
            <span>{status || "..."}</span>
            <span className="ml-auto">
              {progress != null ? `${progress}%` : ""}
            </span>
          </FieldLabel>
          <Progress className="w-full" value={progress || 0} max={100} />
        </Field>

        <DialogFooter>
          <Button variant="destructive">Abort</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

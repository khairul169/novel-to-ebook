import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { streamSSE } from "@/lib/sse";
import type { Task } from "backend/app/extract/context";
import { useEffect, useState } from "react";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    streamSSE("/extract/tasks", "get", {
      signal: controller.signal,
      onMessage: (event, data) => {
        if (event === "tasks") setTasks(data);
        console.log(event, data);
      },
    });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 bg-background rounded-md p-4 shadow-lg w-96 border border-zinc-300">
      <Label>Tasks</Label>

      {!tasks.length && <p className="text-xs mt-2">No tasks</p>}

      {tasks.map((task) => (
        <div key={task.id} className="text-xs mt-2 pt-2 border-t">
          <Field className="w-full">
            <FieldLabel>
              <span className="truncate">{task.data?.title || "..."}</span>
              <span className="ml-auto">{`${Math.round(task.progress)}%`}</span>
            </FieldLabel>
            <Progress className="w-full" value={task.progress} max={100} />
          </Field>
        </div>
      ))}
    </div>
  );
}

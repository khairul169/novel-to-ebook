import EventEmitter from "events";
import { uuid } from "../../lib/utils";

export type Task = {
  id: string;
  progress: number;
  data?: any | null;
  status: "pending" | "running" | "success" | "error";
  error?: Error | null;
  fn: () => Promise<void>;
};

type Events = {
  add: { task: Task };
  update: { id: string; values: Partial<Task> };
  remove: { id: string };
  change: { tasks: Task[] };
};

export const taskEvents = new EventEmitter() as {
  on<E extends keyof Events>(
    event: E,
    listener: (data: Events[E]) => void,
  ): any;
  off<E extends keyof Events>(
    event: E,
    listener: (data: Events[E]) => void,
  ): any;
  emit<E extends keyof Events>(event: E, data: Events[E]): boolean;
};

const tasks: Task[] = [];

async function runTask(task: Task) {
  try {
    setTask(task.id, { status: "running", error: null });
    await task.fn();
    setTask(task.id, { status: "success" });
  } catch (err) {
    setTask(task.id, { status: "error", error: err as never });
  }

  // Run next task
  const pendingTask = tasks.find((t) => t.status === "pending");
  if (pendingTask) {
    runTask(pendingTask);
  }
}

export function addTask(fn: () => Promise<void>) {
  const task: Task = { fn, id: uuid(), status: "pending", progress: 0 };
  tasks.unshift(task);
  taskEvents.emit("add", { task });
  taskEvents.emit("change", { tasks });

  if (!tasks.find((t) => t.status === "running")) {
    runTask(task);
  }
  return task;
}

export function setTask(id: string, values: Partial<Task>) {
  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = { ...tasks[index], ...values } as never;
  taskEvents.emit("update", { id, values });
  taskEvents.emit("change", { tasks });
  console.log("setTask", id, values);
}

export function removeTask(id: string) {
  const index = tasks.findIndex((t) => t.id === id);
  tasks.splice(index, 1);
  taskEvents.emit("remove", { id });
  taskEvents.emit("change", { tasks });
}

export function getTasks() {
  return tasks;
}

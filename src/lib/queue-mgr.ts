import { uuid } from "./utils";

type TaskStatus = "queued" | "running" | "success" | "error";

export interface TaskContext {
  setProgress: (value: number, title?: string) => void;
}

export type TaskHandler<T = any> = (ctx: TaskContext) => Promise<T>;

export interface TaskOptions {
  namespace?: string;
  retries?: number;
  retryDelay?: number;
}

export interface QueueConfig {
  maxConcurrent?: number;
  delayMs?: number;
}

export interface Task<T = any> {
  id: string;
  namespace?: string;

  status: TaskStatus;
  progress: number;
  title: string;

  retries: number;
  retryDelay: number;
  attempt: number;

  result?: T;
  error?: string;

  handler: TaskHandler<T>;
}

type EventMap = {
  added: Task;
  started: Task;
  progress: Task;
  success: Task;
  error: Task;
  retrying: Task;
  finished: Task;
  update: Task;
};

type Listener<K extends keyof EventMap> = (task: EventMap[K]) => void;

export class QueueManager {
  private queue: Task[] = [];
  private running = 0;

  private listeners: {
    [K in keyof EventMap]?: Listener<K>[];
  } = {};

  private config: Required<QueueConfig>;

  constructor(config?: QueueConfig) {
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 1,
      delayMs: config?.delayMs ?? 0,
    };
  }

  private emit<K extends keyof EventMap>(event: K, task: EventMap[K]) {
    this.listeners[event]?.forEach((fn) => fn(task));
  }

  on<K extends keyof EventMap>(event: K, fn: Listener<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event]!.push(fn);

    return () => {
      this.listeners[event] = this.listeners[event]?.filter(
        (f) => f !== fn,
      ) as never;
    };
  }

  add<T>(handler: TaskHandler<T>, options?: TaskOptions): Task<T> {
    const task: Task<T> = {
      id: uuid(),
      namespace: options?.namespace,

      status: "queued",
      progress: 0,
      title: "",

      retries: options?.retries ?? 0,
      retryDelay: options?.retryDelay ?? 1000,
      attempt: 0,

      handler,
    };

    this.queue.push(task);
    this.emit("added", task);
    this.emit("update", task);
    this.process();

    return task;
  }

  private async process() {
    const queueList = this.queue
      .filter((i) => i.status === "queued")
      .map((_, idx) => idx);

    while (this.running < this.config.maxConcurrent && queueList.length > 0) {
      const taskIdx = queueList.shift()!;
      const task = this.queue[taskIdx];
      if (!task) continue;

      this.run(task);

      if (this.config.delayMs > 0) {
        await new Promise((r) => setTimeout(r, this.config.delayMs));
      }
    }
  }

  private async run(task: Task) {
    this.running++;

    task.status = "running";
    task.attempt++;

    this.emit("started", task);
    this.emit("update", task);

    const ctx: TaskContext = {
      setProgress: (p, title) => {
        task.progress = p;
        if (title) task.title = title ?? "";
        this.emit("progress", task);
        this.emit("update", task);
      },
    };

    try {
      const result = await task.handler(ctx);

      task.result = result;
      task.status = "success";

      this.emit("success", task);
      this.emit("update", task);
    } catch (err) {
      task.error = (err as Error)?.message || "Something went wrong";

      if (task.attempt <= task.retries) {
        this.emit("retrying", task);
        this.emit("update", task);

        setTimeout(() => {
          task.status = "queued";
          this.queue.push(task);
          this.process();
        }, task.retryDelay);
      } else {
        task.status = "error";

        this.emit("error", task);
        this.emit("update", task);
      }
    } finally {
      this.running--;

      if (task.status === "success" || task.status === "error") {
        this.emit("finished", task);
        this.emit("update", task);
      }

      setTimeout(() => {
        const taskIdx = this.queue.indexOf(task);
        if (taskIdx >= 0) {
          this.queue.splice(taskIdx, 1);
          this.emit("update", task);
        }
      }, 30 * 1000);

      this.process();
    }
  }

  getTasks(namespace?: string) {
    if (!namespace) {
      return [...this.queue];
    }
    return this.queue.filter((t) => t.namespace === namespace);
  }

  getRunningCount() {
    return this.running;
  }
}

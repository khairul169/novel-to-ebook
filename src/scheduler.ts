import { CronJob } from "cron";
import { rescanLibrary } from "./app/library/context";

export function initScheduler() {
  new CronJob("*/10 * * * *", rescanLibrary);

  rescanLibrary();
}

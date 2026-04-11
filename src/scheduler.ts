import { CronJob } from "cron";
import { rescanLibrary } from "./app/library/context";

export function initScheduler() {
  new CronJob("0 */5 * * * *", rescanLibrary, null, true);

  rescanLibrary();
}

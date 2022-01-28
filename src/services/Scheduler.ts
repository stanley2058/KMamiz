import { CronJob } from "cron";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";

export default class Scheduler {
  private static instance?: Scheduler;
  static getInstance = () => this.instance || (this.instance = new this());

  private readonly jobs: Map<string, CronJob> = new Map();
  private constructor() {}

  start() {
    Logger.verbose("Scheduler started.");
    [...this.jobs].forEach(([key, job]) => {
      job.start();
      Logger.verbose(
        `Next ${key} job scheduled on:`,
        job.nextDate().toLocaleString()
      );
    });
  }

  register(
    uniqueJobName: string,
    cronExpr: string,
    onTick: () => void,
    onComplete = () => Logger.verbose(`Scheduled job '${uniqueJobName}' done.`)
  ) {
    try {
      this.jobs.set(
        uniqueJobName,
        this.createCronJob(cronExpr, onTick, onComplete)
      );
    } catch (err) {
      Logger.error(
        `Error occurs during initialization of CronJob: '${uniqueJobName}', with cron expression:`,
        `'${cronExpr}'`
      );
      Logger.plain.error("", err);
      Logger.error(
        "Cannot proceed with incorrect CronJob registration, exiting."
      );
      process.exit(1);
    }
  }

  private createCronJob(
    interval: string,
    onTick: () => void,
    onComplete?: () => void
  ) {
    return new CronJob(
      interval,
      onTick,
      onComplete,
      false,
      GlobalSettings.Timezone
    );
  }
}

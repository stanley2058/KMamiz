import { CronJob } from "cron";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";

export default class Scheduler {
  private static instance?: Scheduler;
  static getInstance = () => this.instance || (this.instance = new this());

  // cron expression: 00:00 everyday
  private static readonly AggregateInterval = "0 0 * * *";
  private static readonly RealtimeInterval = `0/${GlobalSettings.PollingInterval} * * * *`;
  private readonly aggregateJob;
  private readonly realtimeJob;
  private constructor() {
    this.aggregateJob = new CronJob(
      Scheduler.AggregateInterval,
      this.aggregateJobTick,
      () => Logger.info("Scheduled data aggregation done."),
      false,
      GlobalSettings.Timezone
    );

    try {
      this.realtimeJob = new CronJob(
        Scheduler.RealtimeInterval,
        this.realtimeJobTick,
        () => Logger.verbose("Scheduled realtime data collection done."),
        false,
        GlobalSettings.Timezone
      );
    } catch (err) {
      Logger.error(
        "Error occurs during realtime CronJob initialization, with cron expression:",
        `'${Scheduler.RealtimeInterval}'`
      );
      Logger.plain.error("", err);
      process.exit(1);
    }
  }

  start() {
    this.aggregateJob.start();
    this.realtimeJob.start();
  }

  private aggregateJobTick() {}
  private realtimeJobTick() {}
}

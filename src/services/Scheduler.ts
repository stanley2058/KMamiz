import { CronJob } from "cron";
import GlobalSettings from "../GlobalSettings";

export default class Scheduler {
  private static instance?: Scheduler;
  static getInstance = () => this.instance || (this.instance = new this());

  // cron expression: 00:00 everyday
  private static readonly AggregateInterval = "0 0 * * *";
  private static readonly RealtimeInterval = `*/${GlobalSettings.PollingInterval} * * * *`;
  private readonly aggregateJob;
  private readonly realtimeJob;
  private constructor() {
    this.aggregateJob = new CronJob(
      Scheduler.AggregateInterval,
      this.aggregateJobTick,
      null,
      false,
      GlobalSettings.Timezone
    );

    this.realtimeJob = new CronJob(
      Scheduler.RealtimeInterval,
      this.realtimeJobTick,
      null,
      false,
      GlobalSettings.Timezone
    );
  }

  start() {
    this.aggregateJob.start();
    this.realtimeJob.start();
  }

  private aggregateJobTick() {}
  private realtimeJobTick() {}
}

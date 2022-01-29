import GlobalSettings from "../GlobalSettings";
import Scheduler from "./Scheduler";
import ServiceOperator from "./ServiceOperator";

export default class Initializer {
  private static instance?: Initializer;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  firstTimeSetup() {}

  serverStartUp() {
    Scheduler.getInstance().register(
      "aggregation",
      GlobalSettings.AggregateInterval,
      ServiceOperator.getInstance().aggregateDailyData
    );
    Scheduler.getInstance().register(
      "realtime",
      GlobalSettings.RealtimeInterval,
      ServiceOperator.getInstance().retrieveRealtimeData
    );
    Scheduler.getInstance().start();
  }
}

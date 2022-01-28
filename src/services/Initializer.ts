import GlobalSettings from "../GlobalSettings";
import Scheduler from "./Scheduler";

export default class Initializer {
  private static instance?: Initializer;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  firstTimeSetup() {}

  serverStartUp() {
    Scheduler.getInstance().register(
      "aggregation",
      GlobalSettings.AggregateInterval,
      () => {} // TODO: implement data aggregation logics
    );
    Scheduler.getInstance().register(
      "realtime",
      GlobalSettings.RealtimeInterval,
      () => {} // TODO: implement realtime data processing logics
    );
    Scheduler.getInstance().start();
  }
}

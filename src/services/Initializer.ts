import { Trace } from "../classes/Trace";
import IReplicaCount from "../entities/IReplicaCount";
import GlobalSettings from "../GlobalSettings";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import Scheduler from "./Scheduler";
import ServiceOperator from "./ServiceOperator";
import ZipkinService from "./ZipkinService";

export default class Initializer {
  private static instance?: Initializer;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  async firstTimeSetup() {
    const traces = new Trace(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30
      )
    );
    const realtimeData = traces.toRealTimeData();
    const replicas: IReplicaCount[] = [];
    for (const ns of realtimeData.realtimeData.reduce(
      (prev, curr) => prev.add(curr.namespace),
      new Set<string>()
    )) {
      replicas.push(
        ...(await KubernetesService.getInstance().getReplicasFromPodList(ns))
      );
    }

    const { aggregateData, historyData } =
      traces.toAggregatedDataAndHistoryData(replicas);
    await MongoOperator.getInstance().saveAggregateData(aggregateData);
    await MongoOperator.getInstance().saveHistoryData(historyData);
  }

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

import { AggregateData } from "../classes/AggregateData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { Trace } from "../classes/Trace";
import IReplicaCount from "../entities/IReplicaCount";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import Scheduler from "./Scheduler";
import ZipkinService from "./ZipkinService";

export default class ServiceOperator {
  private static instance?: ServiceOperator;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  async aggregateDailyData() {
    const realtimeData = await MongoOperator.getInstance().getAllRealtimeData();
    const traces = new Trace(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000
      )
    );
    const namespaces = realtimeData.realtimeData.reduce(
      (prev, { namespace }) => prev.add(namespace),
      new Set<string>()
    );

    const replicas: IReplicaCount[] = [];
    for (const ns of namespaces) {
      replicas.push(
        ...(await KubernetesService.getInstance().getReplicasFromPodList(ns))
      );
    }
    const { historyData, aggregateData } =
      traces.toAggregatedDataAndHistoryData(replicas);

    const prevAggData = new AggregateData(
      await MongoOperator.getInstance().getAggregateData()
    );
    const newAggData = prevAggData.combine(aggregateData);
    if (prevAggData.aggregateData._id)
      newAggData.aggregateData._id = prevAggData.aggregateData._id;

    await MongoOperator.getInstance().saveAggregateData(
      newAggData.aggregateData
    );
    await MongoOperator.getInstance().saveHistoryData(historyData);
    await MongoOperator.getInstance().deleteAllRealtimeData();
  }

  async retrieveRealtimeData() {
    const job = Scheduler.getInstance().get("realtime");
    if (!job) {
      process.exit(1);
    }

    const traces = new Trace(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        Date.now() - job.lastDate().getTime()
      )
    );

    const namespaces = traces
      .toRealTimeData()
      .realtimeData.reduce(
        (prev, curr) => prev.add(curr.namespace),
        new Set<string>()
      );

    const envoyLogs: EnvoyLogs[] = [];
    for (const ns of namespaces) {
      for (const podName of await KubernetesService.getInstance().getPodNames(
        ns
      )) {
        envoyLogs.push(
          await KubernetesService.getInstance().getEnvoyLogs(ns, podName)
        );
      }
    }

    await MongoOperator.getInstance().saveRealtimeData(
      traces.combineLogsToRealtimeData(
        EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs)
      ).realtimeData
    );
  }
}

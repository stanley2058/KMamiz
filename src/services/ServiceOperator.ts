import { AggregateData } from "../classes/AggregateData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { RealtimeData } from "../classes/RealtimeData";
import { Trace } from "../classes/Trace";
import IReplicaCount from "../entities/IReplicaCount";
import Logger from "../utils/Logger";
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
    const endpointDependencies =
      await MongoOperator.getInstance().getEndpointDependencies();
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
      realtimeData.toAggregatedDataAndHistoryData(
        endpointDependencies.toServiceDependencies(),
        replicas
      );

    const prevAggRaw = await MongoOperator.getInstance().getAggregateData();
    let newAggData = new AggregateData(aggregateData);
    if (prevAggRaw) {
      const prevAggData = new AggregateData(prevAggRaw);
      newAggData = prevAggData.combine(aggregateData);
      if (prevAggData.aggregateData._id)
        newAggData.aggregateData._id = prevAggData.aggregateData._id;
    }

    await MongoOperator.getInstance().saveAggregateData(newAggData);
    await MongoOperator.getInstance().saveHistoryData(historyData);
    await MongoOperator.getInstance().deleteAllRealtimeData();
  }

  async retrieveRealtimeData() {
    const job = Scheduler.getInstance().get("realtime");
    if (!job) {
      return Logger.fatal(
        "Cannot get CronJob: [realtime], were jobs correctly registered?"
      );
    }

    // query traces from last job time to now
    const lookBack = job.nextDate().toDate().getTime() - Date.now();
    const traces = new Trace(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        lookBack
      )
    );

    // get namespaces from traces for querying envoy logs
    const namespaces = traces
      .toRealTimeData()
      .realtimeData.reduce(
        (prev, curr) => prev.add(curr.namespace),
        new Set<string>()
      );

    // get all necessary envoy logs
    const envoyLogs: EnvoyLogs[] = [];
    const replicas: IReplicaCount[] = [];
    for (const ns of namespaces) {
      for (const podName of await KubernetesService.getInstance().getPodNames(
        ns
      )) {
        envoyLogs.push(
          await KubernetesService.getInstance().getEnvoyLogs(ns, podName)
        );
      }
      replicas.concat(
        await KubernetesService.getInstance().getReplicasFromPodList(ns)
      );
    }

    const data = traces.combineLogsToRealtimeData(
      EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs),
      replicas
    );
    await MongoOperator.getInstance().saveRealtimeData(data);

    // dispatch data aggregation asynchronously
    ServiceOperator.getInstance().doBackgroundDataAggregation(traces, data);
  }

  private async doBackgroundDataAggregation(traces: Trace, data: RealtimeData) {
    // merge endpoint dependency and save to database
    await MongoOperator.getInstance().saveEndpointDependencies(
      (
        await MongoOperator.getInstance().getEndpointDependencies()
      ).combineWith(traces.toEndpointDependencies())
    );

    // merge endpoint datatype and save to database
    for (let e of data.extractEndpointDataType()) {
      const existing = await MongoOperator.getInstance().getEndpointDataType(
        e.endpointDataType.uniqueEndpointName
      );
      if (existing) e = e.mergeSchemaWith(existing);
      await MongoOperator.getInstance().saveEndpointDataType(e);
    }
  }
}

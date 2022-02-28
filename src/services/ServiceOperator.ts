import { AggregateData } from "../classes/AggregateData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { RealtimeData } from "../classes/RealtimeData";
import { Trace } from "../classes/Trace";
import IReplicaCount from "../entities/IReplicaCount";
import Logger from "../utils/Logger";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import DataCache from "./DataCache";
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
    const namespaces = realtimeData.getContainingNamespaces();

    const replicas: IReplicaCount[] =
      await KubernetesService.getInstance().getReplicas(namespaces);
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
    const namespaces = traces.toRealTimeData().getContainingNamespaces();

    // get all necessary envoy logs
    const envoyLogs: EnvoyLogs[] = [];
    const replicas: IReplicaCount[] =
      await KubernetesService.getInstance().getReplicas(namespaces);
    for (const ns of namespaces) {
      for (const podName of await KubernetesService.getInstance().getPodNames(
        ns
      )) {
        envoyLogs.push(
          await KubernetesService.getInstance().getEnvoyLogs(ns, podName)
        );
      }
    }

    const data = traces.combineLogsToRealtimeData(
      EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs),
      replicas
    );
    await MongoOperator.getInstance().saveRealtimeData(data);

    // dispatch data aggregation asynchronously
    ServiceOperator.getInstance().doBackgroundDataAggregation(
      traces,
      data,
      replicas
    );
  }

  private async doBackgroundDataAggregation(
    traces: Trace,
    data: RealtimeData,
    replicas: IReplicaCount[]
  ) {
    // merge endpoint dependency and save to database
    const endpointDependencies = (
      await MongoOperator.getInstance().getEndpointDependencies()
    ).combineWith(traces.toEndpointDependencies());
    await MongoOperator.getInstance().saveEndpointDependencies(
      endpointDependencies
    );

    // merge endpoint datatype and save to database
    for (let e of data.extractEndpointDataType()) {
      const existing = await MongoOperator.getInstance().getEndpointDataType(
        e.endpointDataType.uniqueEndpointName
      );
      if (existing) e = existing.mergeSchemaWith(e);
      await MongoOperator.getInstance().saveEndpointDataType(e);
    }

    DataCache.getInstance().updateCurrentView(
      await MongoOperator.getInstance().getAllRealtimeData(),
      endpointDependencies,
      replicas
    );
  }
}

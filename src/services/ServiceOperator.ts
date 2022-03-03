import { AggregateData } from "../classes/AggregateData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { Trace } from "../classes/Trace";
import IReplicaCount from "../entities/IReplicaCount";
import Logger from "../utils/Logger";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import DataCache from "./DataCache";
import Scheduler from "./Scheduler";
import ZipkinService from "./ZipkinService";
import CombinedRealtimeData from "../classes/CombinedRealtimeData";

export default class ServiceOperator {
  private static instance?: ServiceOperator;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  private previousRealtimeTime = Date.now();

  async aggregateDailyData() {
    const combinedRealtimeData =
      await MongoOperator.getInstance().getAllCombinedRealtimeData();
    const endpointDependencies =
      await MongoOperator.getInstance().getEndpointDependencies();
    const namespaces = combinedRealtimeData.getContainingNamespaces();

    const replicas: IReplicaCount[] =
      await KubernetesService.getInstance().getReplicas(namespaces);
    const { historyData, aggregateData } =
      combinedRealtimeData.toAggregatedDataAndHistoryData(
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
    DataCache.getInstance().resetCombinedRealtimeData();
  }

  async retrieveRealtimeData() {
    const job = Scheduler.getInstance().get("realtime");
    if (!job) {
      return Logger.fatal(
        "Cannot get CronJob: [realtime], were jobs correctly registered?"
      );
    }

    // query traces from last job time to now
    const lookBack =
      Date.now() - ServiceOperator.getInstance().previousRealtimeTime;
    ServiceOperator.getInstance().previousRealtimeTime = Date.now();
    let rawTrace =
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        lookBack
      );
    const traces = new Trace(rawTrace.slice(0, 25000));

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

    // dispatch data aggregation asynchronously
    ServiceOperator.getInstance().doBackgroundDataAggregation(
      traces,
      data.toCombinedRealtimeData()
    );
  }

  private async doBackgroundDataAggregation(
    traces: Trace,
    data: CombinedRealtimeData
  ) {
    const existingDep = DataCache.getInstance().getEndpointDependenciesSnap();
    const newDep = traces.toEndpointDependencies();
    const dep = existingDep ? existingDep.combineWith(newDep) : newDep;

    DataCache.getInstance().updateCurrentView(data, dep);
  }
}

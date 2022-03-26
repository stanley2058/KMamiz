import { AggregateData } from "../classes/AggregateData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { Traces } from "../classes/Traces";
import { TReplicaCount } from "../entities/TReplicaCount";
import Logger from "../utils/Logger";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import DataCache from "./DataCache";
import Scheduler from "./Scheduler";
import ZipkinService from "./ZipkinService";
import CombinedRealtimeDataList from "../classes/CombinedRealtimeDataList";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CombinedRealtimeDataModel } from "../entities/schema/CombinedRealtimeDateSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { AggregateDataModel } from "../entities/schema/AggregateDataSchema";
import { HistoryDataModel } from "../entities/schema/HistoryDataSchema";

export default class ServiceOperator {
  private static instance?: ServiceOperator;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  private previousRealtimeTime = Date.now();

  async aggregateDailyData() {
    const combinedRealtimeData = new CombinedRealtimeDataList(
      await MongoOperator.getInstance().findAll(CombinedRealtimeDataModel)
    );
    const endpointDependencies = new EndpointDependencies(
      await MongoOperator.getInstance().findAll(EndpointDependencyModel)
    );
    const namespaces = combinedRealtimeData.getContainingNamespaces();

    const replicas: TReplicaCount[] =
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
      if (prevAggData.toJSON()._id)
        newAggData.toJSON()._id = prevAggData.toJSON()._id;
    }

    await MongoOperator.getInstance().save(
      newAggData.toJSON(),
      AggregateDataModel
    );
    await MongoOperator.getInstance().insertMany(historyData, HistoryDataModel);
    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .reset();
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
    const traces = new Traces(rawTrace.slice(0, 25000));

    // get namespaces from traces for querying envoy logs
    const namespaces = traces.toRealTimeData().getContainingNamespaces();

    // get all necessary envoy logs
    const envoyLogs: EnvoyLogs[] = [];
    const replicas: TReplicaCount[] =
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
    traces: Traces,
    data: CombinedRealtimeDataList
  ) {
    const existingDep = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData();
    const newDep = traces.toEndpointDependencies();
    const dep = existingDep ? existingDep.combineWith(newDep) : newDep;

    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .setData(data);
    DataCache.getInstance()
      .get<CEndpointDependencies>("EndpointDependencies")
      .setData(dep);

    KubernetesService.getInstance()
      .getReplicas(
        DataCache.getInstance()
          .get<CCombinedRealtimeData>("CombinedRealtimeData")
          .getData()
          ?.getContainingNamespaces()
      )
      .then(DataCache.getInstance().get<CReplicas>("ReplicaCounts").setData);

    DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .setData(data.extractEndpointDataType());
  }
}

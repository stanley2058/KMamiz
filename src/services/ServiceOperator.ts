import { AggregatedData } from "../classes/AggregatedData";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { Traces } from "../classes/Traces";
import { TReplicaCount } from "../entities/TReplicaCount";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import DataCache from "./DataCache";
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
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import ServiceUtils from "./ServiceUtils";

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
    const { historicalData, aggregatedData } =
      combinedRealtimeData.toAggregatedDataAndHistoricalData(
        endpointDependencies.toServiceDependencies(),
        replicas
      );

    const prevAggRaw = await MongoOperator.getInstance().getAggregatedData();
    let newAggData = new AggregatedData(aggregatedData);
    if (prevAggRaw) {
      const prevAggData = new AggregatedData(prevAggRaw);
      newAggData = prevAggData.combine(aggregatedData);
      if (prevAggData.toJSON()._id)
        newAggData.toJSON()._id = prevAggData.toJSON()._id;
    }

    await MongoOperator.getInstance().save(
      newAggData.toJSON(),
      AggregatedDataModel
    );
    await MongoOperator.getInstance().insertMany(
      historicalData,
      HistoricalDataModel
    );
    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .reset();
  }

  async retrieveRealtimeData() {
    // query traces from last job time to now
    const lookBack =
      Date.now() - ServiceOperator.getInstance().previousRealtimeTime;
    ServiceOperator.getInstance().previousRealtimeTime = Date.now();
    const traces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        lookBack,
        Date.now(),
        2500
      )
    );

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
      .get<CEndpointDependencies>("EndpointDependencies")
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
      .then((r) =>
        DataCache.getInstance().get<CReplicas>("ReplicaCounts").setData(r)
      );

    DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .setData(data.extractEndpointDataType());

    ServiceUtils.getInstance().updateLabel();
    DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .setData(dep);
  }
}

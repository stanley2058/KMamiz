import { AggregatedData } from "../classes/AggregatedData";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import DataCache from "./DataCache";
import CombinedRealtimeDataList from "../classes/CombinedRealtimeDataList";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import ServiceUtils from "./ServiceUtils";
import EndpointDataType from "../classes/EndpointDataType";
import { Worker } from "worker_threads";
import path from "path";
import { TEndpointDataType } from "../entities/TEndpointDataType";
import Logger from "../utils/Logger";

export default class ServiceOperator {
  private static instance?: ServiceOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private realtimeWorker: Worker;
  private workerLatencyMap: Map<string, number>;
  private constructor() {
    this.workerLatencyMap = new Map();
    this.realtimeWorker = new Worker(
      path.resolve(__dirname, "./worker/RealtimeWorker.js")
    );
    this.realtimeWorker.on("message", (res) => {
      const { uniqueId, rlDataList, dependencies, dataType, log } = res;

      if (log) Logger.verbose(`Worker: ${log}`);

      const startTime = this.workerLatencyMap.get(uniqueId);
      if (startTime) {
        Logger.verbose(
          `Realtime schedule [${uniqueId}] done, in ${Date.now() - startTime}ms`
        );
        this.workerLatencyMap.delete(uniqueId);
      }

      ServiceOperator.getInstance().realtimeUpdateCache(
        new CombinedRealtimeDataList(rlDataList),
        new EndpointDependencies(dependencies),
        (dataType as TEndpointDataType[]).map((dt) => new EndpointDataType(dt))
      );
    });
  }

  private getDataForAggregate() {
    const combinedRealtimeData = DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .getData();
    const endpointDependencies = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData();

    if (!combinedRealtimeData || !endpointDependencies) {
      Logger.warn(
        "Cannot create AggregatedData from empty cache, skipping daily data aggregation"
      );
      return null;
    }
    return { combinedRealtimeData, endpointDependencies };
  }

  async createHistoricalAndAggregatedData() {
    const info = this.getDataForAggregate();
    if (!info) return;
    const { combinedRealtimeData, endpointDependencies } = info;

    const replicas =
      DataCache.getInstance().get<CReplicas>("ReplicaCounts").getData() || [];

    const historicalData = combinedRealtimeData.toHistoricalData(
      endpointDependencies.toServiceDependencies(),
      replicas
    );
    await MongoOperator.getInstance().insertMany(
      historicalData,
      HistoricalDataModel
    );

    const aggregatedData = combinedRealtimeData.toAggregatedData(
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
    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .reset();
  }

  async retrieveRealtimeData() {
    const time = Date.now();
    const uniqueId = Math.floor(Math.random() * Math.pow(16, 4))
      .toString(16)
      .padStart(4, "0");
    this.workerLatencyMap.set(uniqueId, time);
    Logger.verbose(`Running Realtime schedule in worker, [${uniqueId}]`);

    const existingDep = DataCache.getInstance()
      .get<CEndpointDependencies>("EndpointDependencies")
      .getData();

    ServiceOperator.getInstance().realtimeWorker.postMessage({
      uniqueId,
      lookBack: 30000,
      time,
      existingDep: existingDep?.toJSON(),
    });
  }

  private realtimeUpdateCache(
    data: CombinedRealtimeDataList,
    dep: EndpointDependencies,
    dataType: EndpointDataType[]
  ) {
    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .setData(data);
    DataCache.getInstance()
      .get<CEndpointDependencies>("EndpointDependencies")
      .setData(dep);

    const namespaces = DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .getData()
      ?.getContainingNamespaces();
    KubernetesService.getInstance()
      .getReplicas(namespaces)
      .then((r) =>
        DataCache.getInstance().get<CReplicas>("ReplicaCounts").setData(r)
      );

    DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .setData(dataType);

    ServiceUtils.getInstance().updateLabel();
    DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .setData(dep);
  }
}

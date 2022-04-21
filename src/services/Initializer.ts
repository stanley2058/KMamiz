import { AggregatedData } from "../classes/AggregatedData";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { CTaggedSwaggers } from "../classes/Cacheable/CTaggedSwaggers";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import { Traces } from "../classes/Traces";
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import { TReplicaCount } from "../entities/TReplicaCount";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import Utils from "../utils/Utils";
import DataCache from "./DataCache";
import DispatchStorage from "./DispatchStorage";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";
import Scheduler from "./Scheduler";
import ServiceOperator from "./ServiceOperator";
import ServiceUtils from "./ServiceUtils";
import ZipkinService from "./ZipkinService";

export default class Initializer {
  private static instance?: Initializer;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  async firstTimeSetup() {
    const todayTime = new Date(new Date().toLocaleDateString()).getTime();
    // get traces from yesterday to 30 days backward
    const traces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30,
        todayTime
      )
    );

    // try to create aggregatedData and historicalData
    const endpointDependencies = traces.toEndpointDependencies().trim();
    const replicas: TReplicaCount[] = [];
    for (const ns of await KubernetesService.getInstance().getNamespaces()) {
      replicas.push(
        ...(await KubernetesService.getInstance().getReplicasFromPodList(ns))
      );
    }

    const realtimeData = traces
      .toRealTimeData(replicas)
      .toCombinedRealtimeData();
    if (realtimeData.toJSON().length !== 0) {
      const historicalData = realtimeData.toHistoricalData(
        endpointDependencies.toServiceDependencies(),
        replicas,
        undefined,
        Utils.BelongsToDateTimestamp
      );
      const aggregatedData = realtimeData.toAggregatedData(
        endpointDependencies.toServiceDependencies(),
        replicas,
        undefined,
        Utils.BelongsToDateTimestamp
      );
      await MongoOperator.getInstance().save(
        new AggregatedData(aggregatedData).toJSON(),
        AggregatedDataModel
      );
      await MongoOperator.getInstance().insertMany(
        historicalData,
        HistoricalDataModel
      );
    }

    // get traces from 00:00 today local time to now, and save to cache
    const todayTraces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        Date.now() - todayTime
      )
    );
    DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .setData(todayTraces.toRealTimeData(replicas).toCombinedRealtimeData());

    // merge endpoint dependencies and save to cache
    const dependencies = endpointDependencies.combineWith(
      todayTraces.toEndpointDependencies()
    );
    DataCache.getInstance()
      .get<CEndpointDependencies>("EndpointDependencies")
      .setData(dependencies);
    DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .setData(dependencies);
  }

  async forceRecreateEndpointDependencies() {
    const traces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30
      )
    );

    const dependencies = traces.toEndpointDependencies().trim();
    await MongoOperator.getInstance().deleteAll(EndpointDependencyModel);
    await MongoOperator.getInstance().insertMany(
      dependencies.toJSON(),
      EndpointDependencyModel
    );

    DataCache.getInstance()
      .get<CEndpointDependencies>("EndpointDependencies")
      .setData(dependencies);
    DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .setData(dependencies);
  }

  async serverStartUp() {
    Logger.info("Registering caches.");
    DataCache.getInstance().register([
      new CLabelMapping(),
      new CEndpointDataType(),
      new CCombinedRealtimeData(),
      new CEndpointDependencies(),
      new CReplicas(),
      new CTaggedInterfaces(),
      new CTaggedSwaggers(),
      new CLabeledEndpointDependencies(),
      new CUserDefinedLabel(),
    ]);

    Logger.info("Loading data into cache.");
    await DataCache.getInstance().loadBaseData();
    ServiceUtils.getInstance().updateLabel();

    if (!GlobalSettings.ReadOnlyMode) {
      Logger.info("Setting up scheduled tasks.");
      Scheduler.getInstance().register(
        "aggregation",
        GlobalSettings.AggregateInterval,
        () => ServiceOperator.getInstance().createHistoricalAndAggregatedData()
      );
      Scheduler.getInstance().register(
        "realtime",
        GlobalSettings.RealtimeInterval,
        () => ServiceOperator.getInstance().retrieveRealtimeData(),
        () => {}
      );
      Scheduler.getInstance().register(
        "dispatch",
        GlobalSettings.DispatchInterval,
        () => DispatchStorage.getInstance().sync()
      );
      Scheduler.getInstance().start();
    } else {
      Logger.info("Readonly mode enabled, skipping schedule registration.");
    }
  }
}

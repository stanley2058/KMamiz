import { AggregateData } from "../classes/AggregateData";
import { Traces } from "../classes/Traces";
import { TReplicaCount } from "../entities/TReplicaCount";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import DataCache from "./DataCache";
import DispatchStorage from "./DispatchStorage";
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
    const todayTime = new Date(new Date().toLocaleDateString()).getTime();
    // get traces from yesterday to 30 days backward
    const traces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30,
        todayTime
      )
    );

    // try to create aggregateData and historyData
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
      const { aggregateData, historyData } =
        realtimeData.toAggregatedDataAndHistoryData(
          endpointDependencies.toServiceDependencies(),
          replicas
        );
      await MongoOperator.getInstance().saveAggregateData(
        new AggregateData(aggregateData)
      );
      await MongoOperator.getInstance().saveHistoryData(historyData);
    }

    // get traces from 00:00 today local time to now, and save it to database as realtime data
    const todayTraces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        Date.now() - todayTime
      )
    );
    await MongoOperator.getInstance().insertCombinedRealtimeData(
      todayTraces.toRealTimeData(replicas).toCombinedRealtimeData()
    );

    // merge endpoint dependencies and save to database
    await MongoOperator.getInstance().saveEndpointDependencies(
      endpointDependencies.combineWith(todayTraces.toEndpointDependencies())
    );
  }

  async forceRecreateEndpointDependencies() {
    const traces = new Traces(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30
      )
    );

    const dependencies = traces.toEndpointDependencies().trim();
    await MongoOperator.getInstance().deleteAllEndpointDependencies();
    await MongoOperator.getInstance().saveEndpointDependencies(dependencies);
  }

  async serverStartUp() {
    Logger.info("Loading data into cache.");
    await DataCache.getInstance().loadBaseData();

    if (!GlobalSettings.ReadOnlyMode) {
      Logger.info("Setting up scheduled tasks.");
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
      Scheduler.getInstance().register(
        "dispatch",
        GlobalSettings.DispatchInterval,
        DispatchStorage.getInstance().sync
      );
      Scheduler.getInstance().start();
    } else {
      Logger.info("Readonly mode enabled, skipping schedule registration.");
    }
  }
}

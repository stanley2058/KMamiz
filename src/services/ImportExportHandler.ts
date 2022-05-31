import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CLookBackRealtimeData } from "../classes/Cacheable/CLookBackRealtimeData";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { CTaggedSwaggers } from "../classes/Cacheable/CTaggedSwaggers";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import { TAggregatedData } from "../entities/TAggregatedData";
import { THistoricalData } from "../entities/THistoricalData";
import DataCache from "./DataCache";
import DispatchStorage from "./DispatchStorage";
import MongoOperator from "./MongoOperator";
import ServiceUtils from "./ServiceUtils";

export default class ImportExportHandler {
  private static instance?: ImportExportHandler;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  async exportData() {
    const caches = DataCache.getInstance().export();
    const aggregatedData =
      await MongoOperator.getInstance().getAggregatedData();
    const historicalData =
      await MongoOperator.getInstance().getHistoricalData();
    const json = JSON.stringify([
      ...caches,
      ["AggregatedData", aggregatedData],
      ["HistoricalData", historicalData],
    ]);
    return json;
  }

  async clearData() {
    DataCache.getInstance().clear();
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
      new CLookBackRealtimeData(),
    ]);
    await MongoOperator.getInstance().clearDatabase();
  }

  async importData(importData: [string, any][]) {
    if (!importData) return false;

    await MongoOperator.getInstance().clearDatabase();

    // fix Date being converted into string
    const dataType = importData.find(
      ([name]) => name === "EndpointDataType"
    )![1];
    dataType.forEach((dt: any) =>
      dt.schemas.forEach((s: any) => (s.time = new Date(s.time)))
    );

    DataCache.getInstance().import(importData);
    DataCache.getInstance().register([new CLookBackRealtimeData()]);

    const [, aggregatedData] =
      importData.find(([name]) => name === "AggregatedData") || [];
    const [, historicalData] =
      importData.find(([name]) => name === "HistoricalData") || [];

    await MongoOperator.getInstance().insertMany(
      [aggregatedData as TAggregatedData],
      AggregatedDataModel
    );
    await MongoOperator.getInstance().insertMany(
      historicalData as THistoricalData[],
      HistoricalDataModel
    );

    await DispatchStorage.getInstance().syncAll();
    ServiceUtils.getInstance().updateLabel();
    return true;
  }
}

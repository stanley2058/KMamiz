import { AggregatedData } from "../classes/AggregatedData";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import {
  THistoricalData,
  THistoricalServiceInfo,
} from "../entities/THistoricalData";
import DataCache from "../services/DataCache";
import MongoOperator from "../services/MongoOperator";
import EndpointUtils from "../utils/EndpointUtils";
import Logger from "../utils/Logger";

export default class ServiceUtils {
  private static instance?: ServiceUtils;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  private getCaches() {
    const labelMapping =
      DataCache.getInstance().get<CLabelMapping>("LabelMapping");
    const cRlData = DataCache.getInstance().get<CCombinedRealtimeData>(
      "CombinedRealtimeData"
    );
    const labeledDependencies =
      DataCache.getInstance().get<CLabeledEndpointDependencies>(
        "LabeledEndpointDependencies"
      );
    const dependencies = DataCache.getInstance().get<CEndpointDependencies>(
      "EndpointDependencies"
    );
    const replicas = DataCache.getInstance().get<CReplicas>("ReplicaCounts");
    const dataType =
      DataCache.getInstance().get<CEndpointDataType>("EndpointDataType");
    const userDefinedLabel =
      DataCache.getInstance().get<CUserDefinedLabel>("UserDefinedLabel");

    return {
      labelMapping,
      cRlData,
      dependencies,
      labeledDependencies,
      replicas,
      dataType,
      userDefinedLabel,
    };
  }

  updateLabel() {
    Logger.verbose("Updating label mapping");
    const {
      dataType,
      labelMapping,
      userDefinedLabel,
      dependencies,
      labeledDependencies,
    } = this.getCaches();

    const userDefinedLabels = userDefinedLabel.getData();
    const dataTypeData = dataType.getData();
    if (dataTypeData) {
      let preprocessedMapping = new Map<string, string>();
      if (userDefinedLabels) {
        userDefinedLabels.labels.forEach((l) => {
          if (l.block) return;
          l.samples.forEach((s) => preprocessedMapping.set(s, l.label));
        });
      }
      preprocessedMapping = EndpointUtils.GuessAndMergeEndpoints(
        dataTypeData.map((dt) => dt.toJSON().uniqueEndpointName),
        preprocessedMapping
      );

      const labelMap = EndpointUtils.CreateEndpointLabelMapping(
        dataTypeData.filter(
          (d) => !preprocessedMapping.has(d.toJSON().uniqueEndpointName)
        )
      );

      [...preprocessedMapping.entries()].forEach(([ep, label]) =>
        labelMap.set(ep, label)
      );

      labelMapping.setData(
        labelMap,
        userDefinedLabel.getData(),
        dependencies.getData()
      );
    }

    const dep = dependencies.getData();
    if (dep) {
      labeledDependencies.setData(dep);
    }
  }

  async getRealtimeHistoricalData(namespace?: string) {
    const { labelMapping, cRlData, labeledDependencies, replicas } =
      this.getCaches();

    const historicalData = labelMapping.labelHistoricalData(
      await MongoOperator.getInstance().getHistoricalData(namespace)
    );

    const rlData = cRlData.getData();
    const dep = labeledDependencies.getData();

    if (!rlData || !dep) {
      return this.fillInHistoricalData(historicalData);
    }

    const rlHistory = rlData.toHistoricalData(
      dep.toServiceDependencies(),
      replicas.getData(),
      labelMapping.getData()
    );
    return this.fillInHistoricalData(historicalData.concat(rlHistory));
  }

  async getRealtimeAggregatedData(namespace?: string) {
    const { labelMapping, cRlData, labeledDependencies, replicas } =
      this.getCaches();

    const aggregatedData = await MongoOperator.getInstance().getAggregatedData(
      namespace
    );

    const rlData = cRlData.getData();
    const dep = labeledDependencies.getData();

    if (!rlData || !dep) {
      return aggregatedData && labelMapping.labelAggregatedData(aggregatedData);
    }

    const rlAggregatedData = cRlData
      .getData(namespace)!
      .toAggregatedData(
        dep.toServiceDependencies(),
        replicas.getData(),
        labelMapping.getData()
      );
    if (!aggregatedData)
      return labelMapping.labelAggregatedData(rlAggregatedData);

    return labelMapping.labelAggregatedData(
      new AggregatedData(labelMapping.labelAggregatedData(aggregatedData))
        .combine(rlAggregatedData)
        .toJSON()
    );
  }

  private fillInHistoricalData(historicalData: THistoricalData[]) {
    const fillIn = (to: THistoricalData, from: THistoricalData) => {
      const serviceSet = new Set<string>();
      to.services.forEach((s) => serviceSet.add(s.uniqueServiceName));
      const toAdd = from.services
        .filter((s) => !serviceSet.has(s.uniqueServiceName))
        .map((s) => this.cleanHistoricalServiceInfo(to.date, s));
      to.services = to.services.concat(toAdd);
    };

    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (let i = 1; i < historicalData.length; i++) {
      fillIn(historicalData[i], historicalData[i - 1]);
    }
    for (let i = historicalData.length - 2; i >= 0; i--) {
      fillIn(historicalData[i], historicalData[i + 1]);
    }

    return historicalData;
  }
  private cleanHistoricalServiceInfo(
    date: Date,
    serviceInfo: THistoricalServiceInfo
  ): THistoricalServiceInfo {
    const endpoints = serviceInfo.endpoints.map((e) => {
      return {
        ...e,
        latencyCV: 0,
        requests: 0,
        requestErrors: 0,
        serverErrors: 0,
      };
    });

    return {
      ...serviceInfo,
      date,
      endpoints,
      latencyCV: 0,
      requestErrors: 0,
      serverErrors: 0,
      requests: 0,
      risk: 0,
    };
  }
}

import { AggregatedData } from "../classes/AggregatedData";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
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
    Logger.verbose("Updating label mapping.");
    const {
      dataType,
      labelMapping,
      userDefinedLabel,
      dependencies,
      labeledDependencies,
    } = this.getCaches();

    const dataTypeData = dataType.getData();
    if (dataTypeData) {
      labelMapping.setData(
        EndpointUtils.CreateEndpointLabelMapping(dataTypeData),
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
      return historicalData;
    }

    const rlHistory = rlData.toHistoricalData(
      dep.toServiceDependencies(),
      replicas.getData(),
      labelMapping.getData()
    );
    return historicalData.concat(rlHistory);
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
      .toAggregatedDataAndHistoricalData(
        dep.toServiceDependencies(),
        replicas.getData(),
        labelMapping.getData()
      ).aggregatedData;
    if (!aggregatedData) return rlAggregatedData;

    return labelMapping.labelAggregatedData(
      new AggregatedData(labelMapping.labelAggregatedData(aggregatedData))
        .combine(rlAggregatedData)
        .toJSON()
    );
  }
}

import { AggregateData } from "../classes/AggregateData";
import CombinedRealtimeDataList from "../classes/CombinedRealtimeDataList";
import EndpointDataType from "../classes/EndpointDataType";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAggregateData } from "../entities/TAggregateData";
import { THistoryData } from "../entities/THistoryData";
import { TReplicaCount } from "../entities/TReplicaCount";
import EndpointUtils from "../utils/EndpointUtils";
import Logger from "../utils/Logger";
import Utils from "../utils/Utils";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";

export default class DataCache {
  private static instance?: DataCache;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  private _combinedRealtimeDataView?: CombinedRealtimeDataList;
  private _endpointDependenciesView?: EndpointDependencies;
  private _labeledEndpointDependenciesView?: EndpointDependencies;
  private _endpointDataType: EndpointDataType[] = [];
  private _replicasView?: TReplicaCount[];
  private _labelMapping = new Map<string, string>();

  updateCurrentView(
    data: CombinedRealtimeDataList,
    endpointDependencies: EndpointDependencies
  ) {
    this.setCombinedRealtimeData(data);
    this.setEndpointDependencies(endpointDependencies);

    KubernetesService.getInstance()
      .getReplicas(this._combinedRealtimeDataView?.getContainingNamespaces())
      .then((res) => (this._replicasView = res));
  }

  resetCombinedRealtimeData() {
    this._combinedRealtimeDataView = undefined;
  }

  async getRealtimeHistoryData(namespace?: string) {
    const historyData = this.labelHistoryData(
      await MongoOperator.getInstance().getHistoryData(namespace)
    );

    if (
      !this._combinedRealtimeDataView ||
      !this._labeledEndpointDependenciesView
    ) {
      return historyData;
    }

    const rlHistory = this._combinedRealtimeDataView.toHistoryData(
      this._labeledEndpointDependenciesView.toServiceDependencies(),
      this._replicasView,
      this._labelMapping
    );
    return historyData.concat(rlHistory);
  }

  async getRealtimeAggregateData(namespace?: string) {
    const aggregateData = await MongoOperator.getInstance().getAggregateData(
      namespace
    );
    if (
      !this._combinedRealtimeDataView ||
      !this._labeledEndpointDependenciesView
    ) {
      return aggregateData && this.labelAggregateData(aggregateData);
    }
    const rlAggregateData = this.filterCombinedRealtimeData(
      this._combinedRealtimeDataView,
      namespace
    ).toAggregatedDataAndHistoryData(
      this._labeledEndpointDependenciesView.toServiceDependencies(),
      this._replicasView,
      this._labelMapping
    ).aggregateData;
    if (!aggregateData) return rlAggregateData;

    return this.labelAggregateData(
      new AggregateData(this.labelAggregateData(aggregateData))
        .combine(rlAggregateData)
        .toJSON()
    );
  }

  async loadBaseData() {
    Logger.verbose("Loading EndpointDataType into cache.");
    this.setEndpointDataType(
      await MongoOperator.getInstance().getAllEndpointDataTypes()
    );
    Logger.verbose("Loading CombinedRealtimeData into cache.");
    this.setCombinedRealtimeData(
      await MongoOperator.getInstance().getAllCombinedRealtimeData()
    );
    Logger.verbose("Loading EndpointDependencies into cache.");
    this.setEndpointDependencies(
      await MongoOperator.getInstance().getEndpointDependencies()
    );
    Logger.verbose("Loading current ReplicaCounts into cache.");
    this._replicasView = await KubernetesService.getInstance().getReplicas(
      this._combinedRealtimeDataView?.getContainingNamespaces()
    );
  }

  private setCombinedRealtimeData(data: CombinedRealtimeDataList) {
    if (!this._combinedRealtimeDataView) this._combinedRealtimeDataView = data;
    else {
      this._combinedRealtimeDataView =
        this._combinedRealtimeDataView.combineWith(data);
    }

    this.setEndpointDataType(
      this._combinedRealtimeDataView.extractEndpointDataType()
    );
  }

  private setEndpointDataType(newDataType: EndpointDataType[]) {
    if (this._endpointDataType) {
      const dataTypeMap = new Map<string, EndpointDataType>();
      this._endpointDataType.forEach((d) => {
        dataTypeMap.set(d.toJSON().uniqueEndpointName, d);
      });

      newDataType.forEach((d) => {
        const id = d.toJSON().uniqueEndpointName;
        const existing = dataTypeMap.get(id);
        dataTypeMap.set(id, existing ? existing.mergeSchemaWith(d) : d);
      });

      newDataType = [...dataTypeMap.values()];
    }

    this._endpointDataType = newDataType.map((t) => t.trim());
    this._labelMapping = EndpointUtils.CreateEndpointLabelMapping(
      this._endpointDataType
    );
  }

  private setEndpointDependencies(endpointDependencies: EndpointDependencies) {
    endpointDependencies = endpointDependencies.trim();
    this._endpointDependenciesView = endpointDependencies;

    const uniqueNames = [
      ...new Set(
        this._endpointDependenciesView
          .toJSON()
          .flatMap((d) =>
            [...d.dependBy, ...d.dependsOn, d].map(
              (dep) => dep.endpoint.uniqueEndpointName
            )
          )
      ),
    ];
    this._labelMapping = EndpointUtils.GuessAndMergeEndpoints(
      uniqueNames,
      this._labelMapping
    );

    this._labeledEndpointDependenciesView = new EndpointDependencies(
      endpointDependencies.label()
    );
  }

  private filterCombinedRealtimeData(
    data: CombinedRealtimeDataList,
    namespace?: string
  ) {
    if (!namespace) return data;
    const combinedRealtimeData = data.toJSON();
    return new CombinedRealtimeDataList(
      combinedRealtimeData.filter((r) => r.namespace === namespace)
    );
  }

  get combinedRealtimeDataSnap() {
    return this._combinedRealtimeDataView;
  }

  get replicasSnap() {
    return this._replicasView;
  }

  get endpointDataTypeSnap() {
    return this._endpointDataType;
  }

  get labelMapping() {
    return this._labelMapping;
  }

  getRawEndpointDependenciesSnap(namespace?: string) {
    if (namespace && this._endpointDependenciesView) {
      return new EndpointDependencies(
        this._endpointDependenciesView
          .toJSON()
          .filter((d) => d.endpoint.namespace === namespace)
      );
    }
    return this._endpointDependenciesView;
  }

  getEndpointDependenciesSnap(namespace?: string) {
    if (namespace && this._labeledEndpointDependenciesView) {
      return new EndpointDependencies(
        this._labeledEndpointDependenciesView
          .toJSON()
          .filter((d) => d.endpoint.namespace === namespace)
      );
    }
    return this._labeledEndpointDependenciesView;
  }

  getEndpointDataTypesByLabel(label: string) {
    const names = new Set(this.getEndpointsFromLabel(label));
    return this._endpointDataType.filter((d) =>
      names.has(d.toJSON().uniqueEndpointName)
    );
  }

  getLabelFromUniqueEndpointName(uniqueName: string) {
    const label = this._labelMapping.get(uniqueName);
    if (label) return label;
    const [, , , , url] = uniqueName.split("\t");
    const [, , path] = Utils.ExplodeUrl(url);
    return path;
  }

  getEndpointsFromLabel(label: string) {
    const labelMap = new Map<string, string[]>();
    [...this._labelMapping.entries()].forEach(([name, l]) => {
      labelMap.set(l, (labelMap.get(l) || []).concat([name]));
    });
    return labelMap.get(label) || [label];
  }

  labelHistoryData(historyData: THistoryData[]) {
    const uniqueNames = new Set(
      historyData
        .flatMap((h) => h.services)
        .flatMap((s) => s.endpoints)
        .flatMap((e) => e.uniqueEndpointName)
    );
    this._labelMapping = EndpointUtils.GuessAndMergeEndpoints(
      [...uniqueNames],
      this._labelMapping
    );

    historyData.forEach((h) => {
      h.services.forEach((s) => {
        s.endpoints.forEach((e) => {
          e.labelName = this.getLabelFromUniqueEndpointName(
            e.uniqueEndpointName
          );
        });
      });
    });
    return historyData;
  }

  labelAggregateData(aggregateData: TAggregateData) {
    const uniqueNames = new Set(
      aggregateData.services
        .flatMap((s) => s.endpoints)
        .flatMap((e) => e.uniqueEndpointName)
    );
    this._labelMapping = EndpointUtils.GuessAndMergeEndpoints(
      [...uniqueNames],
      this._labelMapping
    );

    aggregateData.services.forEach((s) => {
      s.endpoints.forEach((e) => {
        e.labelName = this.getLabelFromUniqueEndpointName(e.uniqueEndpointName);
      });
    });
    return aggregateData;
  }
}

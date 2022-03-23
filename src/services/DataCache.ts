import { AggregateData } from "../classes/AggregateData";
import { Cacheable } from "../classes/Cacheable/Cacheable";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import CombinedRealtimeDataList from "../classes/CombinedRealtimeDataList";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAggregateData } from "../entities/TAggregateData";
import { TEndpointLabel } from "../entities/TEndpointLabel";
import { THistoryData } from "../entities/THistoryData";
import { TTaggedInterface } from "../entities/TTaggedInterface";
import EndpointUtils from "../utils/EndpointUtils";
import Logger from "../utils/Logger";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";

export default class DataCache {
  private static instance?: DataCache;
  static getInstance = () => this.instance || (this.instance = new this());

  private _cCombinedRealtimeData: CCombinedRealtimeData;
  private _cEndpointDependencies: CEndpointDependencies;
  private _cLabeledEndpointDependencies: CLabeledEndpointDependencies;
  private _cEndpointDataType: CEndpointDataType;
  private _cReplicas: CReplicas;
  private _cLabelMapping: CLabelMapping;
  private _cUserDefinedLabel: CUserDefinedLabel;
  private _cTaggedInterfaces: CTaggedInterfaces;

  private _caches: Cacheable<any>[];
  private constructor() {
    // NOTICE: order in array decides initialization order
    this._caches = [
      (this._cLabelMapping = new CLabelMapping()),
      (this._cEndpointDataType = new CEndpointDataType()),
      (this._cCombinedRealtimeData = new CCombinedRealtimeData()),
      (this._cEndpointDependencies = new CEndpointDependencies()),
      (this._cReplicas = new CReplicas()),
      (this._cTaggedInterfaces = new CTaggedInterfaces()),
      (this._cLabeledEndpointDependencies = new CLabeledEndpointDependencies()),
      (this._cUserDefinedLabel = new CUserDefinedLabel()),
    ];
  }

  async loadBaseData() {
    const promises: Promise<any>[] = [];
    this._caches.forEach((c) => {
      if (c.init) {
        Logger.verbose(`Loading ${c.name} into cache.`);
        promises.push(c.init());
      }
    });

    for (const promise of promises) await promise;

    Logger.verbose("Creating label mapping.");
    this.updateLabel();
  }

  updateLabel() {
    this.updateLabelMap();
    this.relabel();
  }

  private updateLabelMap() {
    const dataType = this._cEndpointDataType.getData();
    if (dataType) {
      this._cLabelMapping.setData(
        EndpointUtils.CreateEndpointLabelMapping(dataType),
        this._cUserDefinedLabel.getData(),
        this._cEndpointDependencies.getData()
      );
    }
  }

  private relabel() {
    const dep = this._cEndpointDependencies.getData();
    if (dep) {
      this._cLabeledEndpointDependencies.setData(dep);
    }
  }

  updateCurrentView(
    data: CombinedRealtimeDataList,
    endpointDependencies: EndpointDependencies
  ) {
    this._cCombinedRealtimeData.setData(data);
    this._cEndpointDependencies.setData(endpointDependencies);
    KubernetesService.getInstance()
      .getReplicas(
        this._cCombinedRealtimeData.getData()?.getContainingNamespaces()
      )
      .then((res) => this._cReplicas.setData(res));

    this._cEndpointDataType.setData(data.extractEndpointDataType());
  }

  resetCombinedRealtimeData() {
    this._cCombinedRealtimeData = new CCombinedRealtimeData();
  }

  async getRealtimeHistoryData(namespace?: string) {
    const historyData = this._cLabelMapping.labelHistoryData(
      await MongoOperator.getInstance().getHistoryData(namespace)
    );

    const rlData = this._cCombinedRealtimeData.getData();
    const labeledDependencies = this._cLabeledEndpointDependencies.getData();

    if (!rlData || !labeledDependencies) {
      return historyData;
    }

    const rlHistory = rlData.toHistoryData(
      labeledDependencies.toServiceDependencies(),
      this._cReplicas.getData(),
      this._cLabelMapping.getData()
    );
    return historyData.concat(rlHistory);
  }

  async getRealtimeAggregateData(namespace?: string) {
    const aggregateData = await MongoOperator.getInstance().getAggregateData(
      namespace
    );

    const rlData = this._cCombinedRealtimeData.getData();
    const labeledDependencies = this._cLabeledEndpointDependencies.getData();

    if (!rlData || !labeledDependencies) {
      return (
        aggregateData && this._cLabelMapping.labelAggregateData(aggregateData)
      );
    }

    const rlAggregateData = this._cCombinedRealtimeData
      .getData(namespace)!
      .toAggregatedDataAndHistoryData(
        labeledDependencies.toServiceDependencies(),
        this._cReplicas.getData(),
        this._cLabelMapping.getData()
      ).aggregateData;
    if (!aggregateData) return rlAggregateData;

    return this.labelAggregateData(
      new AggregateData(this.labelAggregateData(aggregateData))
        .combine(rlAggregateData)
        .toJSON()
    );
  }

  // The following methods are kept as proxy to preserve backwards compatibility

  get combinedRealtimeDataSnap() {
    return this._cCombinedRealtimeData.getData();
  }
  get replicasSnap() {
    return this._cReplicas.getData();
  }
  get endpointDataTypeSnap() {
    return this._cEndpointDataType.getData() || [];
  }

  get labelMapping() {
    return this._cLabelMapping.getData()!;
  }

  get userDefinedLabels() {
    return this._cUserDefinedLabel.getData();
  }

  get taggedInterfaces() {
    return this._cTaggedInterfaces.getData();
  }

  getTaggedInterface(uniqueLabelName: string) {
    return this._cTaggedInterfaces.getData(uniqueLabelName);
  }

  getRawEndpointDependenciesSnap(namespace?: string) {
    return this._cEndpointDependencies.getData(namespace);
  }

  getEndpointDependenciesSnap(namespace?: string) {
    return this._cLabeledEndpointDependencies.getData(namespace);
  }

  getEndpointDataTypesByLabel(
    label: string,
    uniqueServiceName: string,
    method: string
  ) {
    return this._cLabelMapping.getEndpointDataTypesByLabel(
      label,
      uniqueServiceName,
      method,
      this._cEndpointDataType.getData() || []
    );
  }

  getLabelFromUniqueEndpointName(uniqueName: string) {
    return this._cLabelMapping.getLabelFromUniqueEndpointName(uniqueName);
  }

  getEndpointsFromLabel(label: string) {
    return this._cLabelMapping.getEndpointsFromLabel(label);
  }

  labelHistoryData(historyData: THistoryData[]) {
    return this._cLabelMapping.labelHistoryData(historyData);
  }

  labelAggregateData(aggregateData: TAggregateData) {
    return this._cLabelMapping.labelAggregateData(aggregateData);
  }

  updateUserDefinedLabel(label: TEndpointLabel) {
    this._cUserDefinedLabel.update(label);
  }

  addUserDefinedLabel(label: TEndpointLabel) {
    this._cUserDefinedLabel.add(label);
  }

  deleteUserDefinedLabel(
    labelName: string,
    uniqueServiceName: string,
    method: string
  ) {
    this._cUserDefinedLabel.delete(labelName, uniqueServiceName, method);
  }

  addTaggedInterface(tagged: TTaggedInterface) {
    this._cTaggedInterfaces.add(tagged);
  }

  deleteTaggedInterface(uniqueLabelName: string, userLabel: string) {
    this._cTaggedInterfaces.delete(uniqueLabelName, userLabel);
  }
}

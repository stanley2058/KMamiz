import { AggregateData } from "../classes/AggregateData";
import EndpointDataType from "../classes/EndpointDataType";
import { EndpointDependencies } from "../classes/EndpointDependency";
import { RealtimeData } from "../classes/RealtimeData";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import IReplicaCount from "../entities/IReplicaCount";
import EndpointUtils from "../utils/EndpointUtils";
import Logger from "../utils/Logger";
import Utils from "../utils/Utils";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";

export default class DataCache {
  private static instance?: DataCache;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  private _currentRealtimeDataView?: RealtimeData;
  private _currentEndpointDependenciesView?: EndpointDependencies;
  private _currentLabeledEndpointDependenciesView?: EndpointDependencies;
  private _currentEndpointDataType: EndpointDataType[] = [];
  private _currentReplicasView?: IReplicaCount[];
  private _currentLabelMapping = new Map<string, string>();

  updateCurrentView(
    data: RealtimeData,
    endpointDependencies: EndpointDependencies
  ) {
    this.setRealtimeData(data);
    this.setEndpointDependencies(endpointDependencies);

    KubernetesService.getInstance()
      .getReplicas(this._currentRealtimeDataView?.getContainingNamespaces())
      .then((res) => (this._currentReplicasView = res));
  }

  private setRealtimeData(data: RealtimeData) {
    this._currentRealtimeDataView = new RealtimeData(
      (this._currentRealtimeDataView?.realtimeData || []).concat(
        data.realtimeData
      )
    );
    this._currentEndpointDataType = this._currentEndpointDataType.concat(
      data.extractEndpointDataType()
    );
    this._currentLabelMapping = EndpointUtils.CreateEndpointLabelMapping(
      this._currentEndpointDataType
    );
  }
  private setEndpointDependencies(endpointDependencies: EndpointDependencies) {
    this._currentEndpointDependenciesView = endpointDependencies;
    this._currentLabeledEndpointDependenciesView = new EndpointDependencies(
      endpointDependencies.label()
    );
  }

  async getRealtimeHistoryData(namespace?: string) {
    const { realtimeData, endpointDependencies, replicas } =
      await this.getNecessaryData(namespace);

    const historyData = (
      await MongoOperator.getInstance().getHistoryData(namespace)
    ).concat(
      realtimeData.toHistoryData(
        endpointDependencies.toServiceDependencies(),
        replicas
      )
    );
    return this.labelHistoryData(historyData);
  }

  async getRealtimeAggregateData(namespace?: string) {
    const { realtimeData, endpointDependencies, replicas } =
      await this.getNecessaryData(namespace);

    const aggregateData = await MongoOperator.getInstance().getAggregateData(
      namespace
    );
    if (realtimeData.realtimeData.length === 0) return aggregateData;
    const { aggregateData: rlAggregateData } =
      realtimeData.toAggregatedDataAndHistoryData(
        endpointDependencies.toServiceDependencies(),
        replicas
      );
    if (!aggregateData) return this.labelAggregateData(rlAggregateData);
    const aggData = new AggregateData(aggregateData).combine(
      rlAggregateData
    ).aggregateData;
    return this.labelAggregateData(aggData);
  }

  get realtimeDataSnap() {
    return this._currentRealtimeDataView;
  }

  getEndpointDependenciesSnap(namespace?: string) {
    if (namespace && this._currentLabeledEndpointDependenciesView) {
      return new EndpointDependencies(
        this._currentLabeledEndpointDependenciesView.dependencies.filter(
          (d) => d.endpoint.namespace === namespace
        )
      );
    }
    return this._currentLabeledEndpointDependenciesView;
  }

  get replicasSnap() {
    return this._currentReplicasView;
  }

  get endpointDataTypeSnap() {
    return this._currentEndpointDataType;
  }

  get labelMapping() {
    return this._currentLabelMapping;
  }

  private async getNecessaryData(namespace?: string) {
    const realtimeData = await this.getRealtimeData(namespace);
    const endpointDependencies = await this.getEndpointDependencies(namespace);
    const replicas = await this.getReplicas(realtimeData);
    return { realtimeData, endpointDependencies, replicas };
  }

  private filterRealtimeData(data: RealtimeData, namespace?: string) {
    if (!namespace) return data;
    const { realtimeData } = data;
    return new RealtimeData(
      realtimeData.filter((r) => r.namespace === namespace)
    );
  }
  private async getRealtimeData(namespace?: string) {
    if (!this._currentRealtimeDataView) {
      this.setRealtimeData(
        await MongoOperator.getInstance().getAllRealtimeData()
      );
    }
    return this.filterRealtimeData(this._currentRealtimeDataView!, namespace);
  }
  private async getEndpointDependencies(namespace?: string) {
    if (!this._currentEndpointDependenciesView) {
      this.setEndpointDependencies(
        await MongoOperator.getInstance().getEndpointDependencies(namespace)
      );
    }
    return this._currentEndpointDependenciesView!;
  }
  private async getReplicas(realtimeData: RealtimeData) {
    if (!this._currentReplicasView) {
      this._currentReplicasView =
        await KubernetesService.getInstance().getReplicas(
          realtimeData.getContainingNamespaces()
        );
    }
    return this._currentReplicasView;
  }

  getLabelFromUniqueEndpointName(uniqueName: string) {
    const label = this._currentLabelMapping.get(uniqueName);
    if (label) return label;
    const [, , , , url] = uniqueName.split("\t");
    const [, , path] = Utils.ExplodeUrl(url);
    return path;
  }

  getEndpointsFromLabel(label: string) {
    const labelMap = new Map<string, string[]>();
    [...this._currentLabelMapping.entries()].forEach(([name, l]) => {
      labelMap.set(l, (labelMap.get(l) || []).concat([name]));
    });
    return labelMap.get(label) || [label];
  }

  async loadBaseData() {
    Logger.verbose("Loading RealtimeData into cache.");
    await this.getRealtimeData();
    Logger.verbose("Loading EndpointDependencies into cache.");
    await this.getEndpointDependencies();
    Logger.verbose("Loading current ReplicaCounts into cache.");
    this._currentReplicasView =
      await KubernetesService.getInstance().getReplicas(
        this._currentRealtimeDataView?.getContainingNamespaces()
      );
  }

  labelHistoryData(historyData: IHistoryData[]) {
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
  labelAggregateData(aggregateData: IAggregateData) {
    aggregateData.services.forEach((s) => {
      s.endpoints.forEach((e) => {
        e.labelName = this.getLabelFromUniqueEndpointName(e.uniqueEndpointName);
      });
    });
    return aggregateData;
  }
}

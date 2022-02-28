import { AggregateData } from "../classes/AggregateData";
import { EndpointDependencies } from "../classes/EndpointDependency";
import { RealtimeData } from "../classes/RealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import KubernetesService from "./KubernetesService";
import MongoOperator from "./MongoOperator";

export default class DataCache {
  private static instance?: DataCache;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  private _currentRealtimeDataView?: RealtimeData;
  private _currentEndpointDependenciesView?: EndpointDependencies;
  private _currentReplicasView?: IReplicaCount[];

  updateCurrentView(
    data: RealtimeData,
    endpointDependencies: EndpointDependencies,
    replicas: IReplicaCount[]
  ) {
    this._currentRealtimeDataView = data;
    this._currentEndpointDependenciesView = endpointDependencies;
    this._currentReplicasView = replicas;
  }

  async getRealtimeHistoryData(namespace?: string) {
    const { realtimeData, endpointDependencies, replicas } =
      await this.getNecessaryData(namespace);

    return (await MongoOperator.getInstance().getHistoryData(namespace)).concat(
      realtimeData.toHistoryData(
        endpointDependencies.toServiceDependencies(),
        replicas
      )
    );
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
    if (!aggregateData) return rlAggregateData;
    return new AggregateData(aggregateData).combine(rlAggregateData)
      .aggregateData;
  }

  get realtimeDataSnap() {
    return this._currentRealtimeDataView;
  }

  getEndpointDependenciesSnap(namespace?: string) {
    if (namespace && this._currentEndpointDependenciesView) {
      return new EndpointDependencies(
        this._currentEndpointDependenciesView.dependencies.filter(
          (d) => d.endpoint.namespace === namespace
        )
      );
    }
    return this._currentEndpointDependenciesView;
  }

  get replicasSnap() {
    return this._currentReplicasView;
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
    let realtimeData = this._currentRealtimeDataView;
    if (!realtimeData)
      realtimeData = await MongoOperator.getInstance().getAllRealtimeData();
    return this.filterRealtimeData(realtimeData, namespace);
  }
  private async getEndpointDependencies(namespace?: string) {
    if (this._currentEndpointDependenciesView)
      return this._currentEndpointDependenciesView;
    return await MongoOperator.getInstance().getEndpointDependencies(namespace);
  }
  private async getReplicas(realtimeData: RealtimeData) {
    if (this._currentReplicasView) return this._currentReplicasView;
    return await KubernetesService.getInstance().getReplicas(
      realtimeData.getContainingNamespaces()
    );
  }
}

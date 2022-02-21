import { connect } from "mongoose";
import { AggregateData } from "../classes/AggregateData";
import { EndpointDependencies } from "../classes/EndpointDependency";
import { RealtimeData } from "../classes/RealtimeData";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import EndpointDataType from "../classes/EndpointDataType";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(GlobalSettings.MongoDBUri).catch((error) => Logger.error(error));
  }

  async getAllRealtimeData() {
    return new RealtimeData([]);
  }

  async getAggregateData(namespace?: string) {
    return {} as IAggregateData;
  }

  async getHistoryData(namespace?: string) {
    return [] as IHistoryData[];
  }

  async getEndpointDependencies(namespace?: string) {
    return new EndpointDependencies([]);
  }

  async getEndpointDataType(
    uniqueEndpointName: string
  ): Promise<EndpointDataType | null> {
    return {} as EndpointDataType;
  }

  async getEndpointDataTypeByService(uniqueServiceName: string) {
    return [] as EndpointDataType[];
  }

  async getEndpointDataTypeByLabel(
    uniqueServiceName: string,
    method: string,
    label: string
  ) {
    return [] as EndpointDataType[];
  }

  async saveRealtimeData(realtimeData: RealtimeData) {}
  async saveAggregateData(aggregateData: AggregateData) {}
  async saveHistoryData(historyData: IHistoryData[]) {}
  async saveEndpointDependencies(endpointDependencies: EndpointDependencies) {}
  async saveEndpointDataType(endpointDataType: EndpointDataType) {}

  async deleteAllRealtimeData() {}
}

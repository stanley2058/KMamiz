import { connect } from "mongoose";
import { RealtimeData } from "../classes/RealtimeData";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";
import GlobalSettings from "../GlobalSettings";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(GlobalSettings.MongoDBUri).catch((error) => console.error(error));
  }

  async getAllRealtimeData() {
    return new RealtimeData([]);
  }
  async deleteAllRealtimeData() {}

  async getAggregateData() {
    return {} as IAggregateData;
  }
  async saveHistoryData(historyData: IHistoryData[]) {}
  async saveAggregateData(aggregateData: IAggregateData) {}
  async saveRealtimeData(realtimeData: IRealtimeData[]) {}
}

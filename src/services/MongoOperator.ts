import { connect } from "mongoose";
import { RealtimeData } from "../classes/RealtimeData";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(process.env.MONGODB_URI ?? "").catch((error) =>
      console.error(error)
    );
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

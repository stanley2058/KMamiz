import { connect, Model, Types } from "mongoose";
import { AggregateData } from "../classes/AggregateData";
import { EndpointDependencies } from "../classes/EndpointDependency";
import { RealtimeData } from "../classes/RealtimeData";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import EndpointDataType from "../classes/EndpointDataType";
import { RealtimeDataModel } from "../entities/schema/RealtimeDataSchema";
import { AggregateDataModel } from "../entities/schema/AggregateDataSchema";
import { HistoryDataModel } from "../entities/schema/HistoryDataSchema";
import { EndpointDataTypeModel } from "../entities/schema/EndpointDataTypeSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(GlobalSettings.MongoDBUri)
      .then(() => Logger.info("Successfully connected to MongoDB"))
      .catch((error) => Logger.error(error));
  }

  async getAllRealtimeData() {
    return new RealtimeData(
      (await RealtimeDataModel.find({}).exec()).map((r) => r.toObject())
    );
  }

  async getAggregateData(namespace?: string) {
    if (!namespace)
      return (await AggregateDataModel.findOne({}).exec())?.toObject();
    const filtered = await AggregateDataModel.aggregate([
      { $match: {} },
      {
        $project: {
          _id: "$_id",
          fromDate: "$fromDate",
          toDate: "$toDate",
          services: {
            $filter: {
              input: "$services",
              as: "service",
              cond: { $eq: ["$$service.namespace", namespace] },
            },
          },
        },
      },
    ]).exec();
    return (filtered[0].toObject() as IAggregateData) || null;
  }

  async getHistoryData(namespace?: string, time = 86400000 * 30) {
    const notBefore = new Date(Date.now() - time);
    if (!namespace) {
      return (
        await HistoryDataModel.find({
          date: { $gte: notBefore },
        }).exec()
      ).map((r) => r.toObject());
    }
    const res = await HistoryDataModel.aggregate([
      { $match: { date: { $gte: notBefore } } },
      {
        $project: {
          _id: "$_id",
          date: "$date",
          services: {
            $filter: {
              input: "$services",
              as: "service",
              cond: { $eq: ["$$service.namespace", namespace] },
            },
          },
        },
      },
    ]).exec();
    return res.map((r) => r.toObject()) as IHistoryData[];
  }

  async getEndpointDependencies(namespace?: string) {
    const query = namespace
      ? {
          endpoint: { namespace },
        }
      : {};
    const res = await EndpointDependencyModel.find(query).exec();
    return new EndpointDependencies(res.map((r) => r.toObject()));
  }

  async getEndpointDataType(uniqueEndpointName: string) {
    const res = await EndpointDataTypeModel.findOne({
      uniqueEndpointName,
    }).exec();
    if (!res) return null;
    return new EndpointDataType(res.toObject());
  }

  async getEndpointDataTypeByService(uniqueServiceName: string) {
    const res = await EndpointDataTypeModel.find({
      uniqueServiceName,
    }).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
  }

  async getEndpointDataTypeByLabel(
    uniqueServiceName: string,
    method: string,
    label: string
  ) {
    const res = await EndpointDataTypeModel.find({
      uniqueServiceName,
      method,
      labelName: label,
    }).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
  }

  async saveRealtimeData(realtimeData: RealtimeData) {
    return new RealtimeData(
      await RealtimeDataModel.insertMany(realtimeData.realtimeData)
    );
  }

  async saveAggregateData(aggregateData: AggregateData) {
    return await this.smartSave(
      aggregateData.aggregateData,
      AggregateDataModel
    );
  }

  async saveHistoryData(historyData: IHistoryData[]): Promise<IHistoryData[]> {
    return (await HistoryDataModel.insertMany(historyData)).map((h) =>
      h.toObject()
    );
  }

  async saveEndpointDependencies(endpointDependencies: EndpointDependencies) {
    const models = endpointDependencies.dependencies.map((d) => {
      const model = new EndpointDependencyModel(d);
      if (d._id) model.isNew = false;
      return model;
    });
    await EndpointDependencyModel.bulkSave(models);
  }

  async saveEndpointDataType(endpointDataType: EndpointDataType) {
    return await this.smartSave(
      endpointDataType.endpointDataType,
      EndpointDataTypeModel
    );
  }

  async deleteAllRealtimeData() {
    return await RealtimeDataModel.deleteMany({});
  }

  private async smartSave<T extends { _id?: Types.ObjectId }>(
    data: T,
    model: Model<T>
  ): Promise<T> {
    const m = new model(data);
    if (!data._id) return await m.save();
    if (await model.findById(data._id).exec()) m.isNew = false;
    return (await m.save()).toObject<T>();
  }
}

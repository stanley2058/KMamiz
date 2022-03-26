import { connect, Model, Types } from "mongoose";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAggregateData } from "../entities/TAggregateData";
import { THistoryData } from "../entities/THistoryData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import { AggregateDataModel } from "../entities/schema/AggregateDataSchema";
import { HistoryDataModel } from "../entities/schema/HistoryDataSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { TEndpointDependency } from "../entities/TEndpointDependency";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(GlobalSettings.MongoDBUri)
      .then(() => Logger.info("Successfully connected to MongoDB"))
      .catch((error) => Logger.error(error));
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
    return (filtered[0].toObject() as TAggregateData) || null;
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
    return res.map((r) => r.toObject()) as THistoryData[];
  }

  async saveEndpointDependencies(endpointDependencies: EndpointDependencies) {
    const results: TEndpointDependency[] = [];
    for (const dep of endpointDependencies.toJSON()) {
      const model = new EndpointDependencyModel(dep);
      if (dep._id) model.isNew = false;
      const result = (await model.save()).toObject();
      results.push(result);
    }
    return new EndpointDependencies(results);
  }

  async delete<T>(ids: Types.ObjectId[], model: Model<T>) {
    return await model.deleteMany({ _id: { $in: ids } }).exec();
  }

  async deleteAll<T>(model: Model<T>) {
    return await model.deleteMany({}).exec();
  }

  async insertMany<T extends { _id?: Types.ObjectId }>(
    arr: T[],
    model: Model<T>
  ) {
    arr.forEach((a) => (a._id = undefined));
    return (await model.insertMany(arr)).map((r) => r.toJSON());
  }

  async findAll<T>(model: Model<T>) {
    return (await model.find({}).exec()).map((r) => r.toJSON()) as T[];
  }

  async save<T extends { _id?: Types.ObjectId }>(
    data: T,
    model: Model<T>
  ): Promise<T> {
    const m = new model(data);
    if (!data._id) return await m.save();
    if (await model.findById(data._id).exec()) m.isNew = false;
    return (await m.save()).toObject<T>();
  }
}

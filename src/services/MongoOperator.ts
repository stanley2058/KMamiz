import { connect, Model, Types, FilterQuery } from "mongoose";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAggregatedData } from "../entities/TAggregatedData";
import { THistoricalData } from "../entities/THistoricalData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { TEndpointDependency } from "../entities/TEndpointDependency";
import { CombinedRealtimeDataModel } from "../entities/schema/CombinedRealtimeDateSchema";
import { EndpointDataTypeModel } from "../entities/schema/EndpointDataTypeSchema";
import { EndpointLabelModel } from "../entities/schema/EndpointLabel";
import { TaggedInterfaceModel } from "../entities/schema/TaggedInterface";
import { TaggedSwaggerModel } from "../entities/schema/TaggedSwagger";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(GlobalSettings.MongoDBUri)
      .then(() => Logger.info("Successfully connected to MongoDB"))
      .catch((error) => Logger.error(error));
  }

  async getAggregatedData(namespace?: string) {
    if (!namespace)
      return (await AggregatedDataModel.findOne({}).exec())?.toObject();
    const filtered = await AggregatedDataModel.aggregate([
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
    return (filtered[0].toObject() as TAggregatedData) || null;
  }

  async getHistoricalData(namespace?: string, time = 86400000 * 30) {
    const notBefore = new Date(Date.now() - time);
    if (!namespace) {
      return (
        await HistoricalDataModel.find({
          date: { $gte: notBefore },
        }).exec()
      ).map((r) => r.toObject());
    }
    const res = await HistoricalDataModel.aggregate([
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
    return res.map((r) => r.toObject()) as THistoricalData[];
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

  async deleteBy<T>(selector: FilterQuery<T>, model: Model<T>) {
    return await model.deleteMany(selector).exec();
  }

  async deleteAll<T>(model: Model<T>) {
    return await model.deleteMany({}).exec();
  }

  async insertMany<T extends { _id?: Types.ObjectId }>(
    arr: T[],
    model: Model<T>
  ) {
    arr = arr.filter((a) => !!a);
    arr.forEach((a) => (a._id = undefined));
    if (arr.length === 0) return;
    return (await model.insertMany(arr)).map((r) => r.toObject());
  }

  async findAll<T>(model: Model<T>) {
    return (await model.find({}).exec()).map((r) => r.toObject()) as T[];
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

  async clearDatabase() {
    if (!GlobalSettings.EnableTestingEndpoints) return;
    await MongoOperator.getInstance().deleteAll(AggregatedDataModel);
    await MongoOperator.getInstance().deleteAll(CombinedRealtimeDataModel);
    await MongoOperator.getInstance().deleteAll(EndpointDataTypeModel);
    await MongoOperator.getInstance().deleteAll(EndpointDependencyModel);
    await MongoOperator.getInstance().deleteAll(EndpointLabelModel);
    await MongoOperator.getInstance().deleteAll(HistoricalDataModel);
    await MongoOperator.getInstance().deleteAll(TaggedInterfaceModel);
    await MongoOperator.getInstance().deleteAll(TaggedSwaggerModel);
  }
}

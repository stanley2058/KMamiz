import { connect, Model, Types } from "mongoose";
import { AggregateData } from "../classes/AggregateData";
import { EndpointDependencies } from "../classes/EndpointDependency";
import IAggregateData from "../entities/IAggregateData";
import IHistoryData from "../entities/IHistoryData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import EndpointDataType from "../classes/EndpointDataType";
import { AggregateDataModel } from "../entities/schema/AggregateDataSchema";
import { HistoryDataModel } from "../entities/schema/HistoryDataSchema";
import { EndpointDataTypeModel } from "../entities/schema/EndpointDataTypeSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { CombinedRealtimeDataModel } from "../entities/schema/CombinedRealtimeDateSchema";
import CombinedRealtimeData from "../classes/CombinedRealtimeData";
import { IEndpointDependency } from "../entities/IEndpointDependency";
import { ICombinedRealtimeData } from "../entities/ICombinedRealtimeData";

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
  async getEndpointDataTypes(uniqueEndpointNames: string[]) {
    const res = await EndpointDataTypeModel.find({
      uniqueEndpointName: { $in: uniqueEndpointNames },
    }).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
  }

  async getEndpointDataTypeByService(uniqueServiceName: string) {
    const res = await EndpointDataTypeModel.find({
      uniqueServiceName,
    }).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
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
    const results: IEndpointDependency[] = [];
    for (const dep of endpointDependencies.dependencies) {
      const model = new EndpointDependencyModel(dep);
      if (dep._id) model.isNew = false;
      try {
        const result = (await model.save()).toObject();
        results.push(result);
      } catch (ex) {
        Logger.error("Error saving EndpointDependencies, skipping.");
        Logger.verbose("", ex);
      }
    }
    return new EndpointDependencies(results);
  }

  async saveEndpointDataType(endpointDataType: EndpointDataType) {
    return await this.smartSave(
      endpointDataType.endpointDataType,
      EndpointDataTypeModel
    );
  }

  async saveEndpointDataTypes(endpointDataType: EndpointDataType[]) {
    const results: EndpointDataType[] = [];
    for (const dataType of endpointDataType) {
      const { endpointDataType } = dataType;
      const model = new EndpointDataTypeModel(endpointDataType);
      if (endpointDataType._id) model.isNew = false;
      try {
        const result = (await model.save()).toObject();
        results.push(new EndpointDataType(result));
      } catch (ex) {
        Logger.error("Error saving EndpointDataType, skipping.");
        Logger.verbose("", ex);
      }
    }
    return results;
  }

  async getAllCombinedRealtimeData() {
    return new CombinedRealtimeData(
      (await CombinedRealtimeDataModel.find({}).exec()).map((r) => r.toObject())
    );
  }

  async insertCombinedRealtimeData(cRlData: CombinedRealtimeData) {
    return new CombinedRealtimeData(
      await CombinedRealtimeDataModel.insertMany(cRlData.combinedRealtimeData)
    );
  }
  async saveCombinedRealtimeData(cRlData: CombinedRealtimeData) {
    const results: ICombinedRealtimeData[] = [];
    for (const rlData of cRlData.combinedRealtimeData) {
      const model = new CombinedRealtimeDataModel(rlData);
      if (rlData._id) model.isNew = false;
      try {
        const result = (await model.save()).toObject();
        results.push(result);
      } catch (ex) {
        Logger.error("Error saving EndpointDataType, skipping.");
        Logger.verbose("", ex);
      }
    }
    return new CombinedRealtimeData(results);
  }

  async deleteAllCombinedRealtimeData() {
    return await CombinedRealtimeDataModel.deleteMany({});
  }
  async deleteAllEndpointDependencies() {
    return await EndpointDataTypeModel.deleteMany({});
  }
  async deleteAllEndpointDataType() {
    return await EndpointDataTypeModel.deleteMany({});
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

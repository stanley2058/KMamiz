import { connect, Model, Types } from "mongoose";
import { AggregateData } from "../classes/AggregateData";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAggregateData } from "../entities/TAggregateData";
import { THistoryData } from "../entities/THistoryData";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
import EndpointDataType from "../classes/EndpointDataType";
import { AggregateDataModel } from "../entities/schema/AggregateDataSchema";
import { HistoryDataModel } from "../entities/schema/HistoryDataSchema";
import { EndpointDataTypeModel } from "../entities/schema/EndpointDataTypeSchema";
import { EndpointDependencyModel } from "../entities/schema/EndpointDependencySchema";
import { CombinedRealtimeDataModel } from "../entities/schema/CombinedRealtimeDateSchema";
import CombinedRealtimeDataList from "../classes/CombinedRealtimeDataList";
import { TEndpointDependency } from "../entities/TEndpointDependency";
import { TCombinedRealtimeData } from "../entities/TCombinedRealtimeData";
import { EndpointLabelModel } from "../entities/schema/EndpointLabel";
import { TEndpointLabel } from "../entities/TEndpointLabel";

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

  async getAllEndpointDataTypes() {
    const res = await EndpointDataTypeModel.find({}).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
  }

  async getEndpointDataTypeByService(uniqueServiceName: string) {
    const res = await EndpointDataTypeModel.find({
      uniqueServiceName,
    }).exec();
    return res.map((r) => new EndpointDataType(r.toObject()));
  }

  async saveAggregateData(aggregateData: AggregateData) {
    return await this.smartSave(aggregateData.toJSON(), AggregateDataModel);
  }

  async saveHistoryData(historyData: THistoryData[]): Promise<THistoryData[]> {
    return (await HistoryDataModel.insertMany(historyData)).map((h) =>
      h.toObject()
    );
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

  async insertEndpointDependencies(endpointDependencies: EndpointDependencies) {
    const dependencies = endpointDependencies.toJSON();
    dependencies.forEach((d) => (d._id = undefined));
    const res = await EndpointDependencyModel.insertMany(dependencies);
    return new EndpointDependencies(res.map((r) => r.toObject()));
  }

  async saveEndpointDataType(endpointDataType: EndpointDataType) {
    return await this.smartSave(
      endpointDataType.toJSON(),
      EndpointDataTypeModel
    );
  }

  async saveEndpointDataTypes(endpointDataType: EndpointDataType[]) {
    const results: EndpointDataType[] = [];
    for (const dataType of endpointDataType) {
      const endpointDataType = dataType.toJSON();
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

  async insertEndpointDataTypes(endpointDataType: EndpointDataType[]) {
    endpointDataType.forEach((e) => (e.toJSON()._id = undefined));
    const res = await EndpointDataTypeModel.insertMany(
      endpointDataType.map((e) => e.toJSON())
    );

    return res.map((r) => r.toObject());
  }

  async getAllCombinedRealtimeData() {
    return new CombinedRealtimeDataList(
      (await CombinedRealtimeDataModel.find({}).exec()).map((r) => r.toObject())
    );
  }

  async insertCombinedRealtimeData(cRlData: CombinedRealtimeDataList) {
    const combinedRealtimeData = cRlData.toJSON();
    combinedRealtimeData.forEach((c) => (c._id = undefined));
    return new CombinedRealtimeDataList(
      await CombinedRealtimeDataModel.insertMany(combinedRealtimeData)
    );
  }

  async saveCombinedRealtimeData(cRlData: CombinedRealtimeDataList) {
    const results: TCombinedRealtimeData[] = [];
    for (const rlData of cRlData.toJSON()) {
      const model = new CombinedRealtimeDataModel(rlData);
      if (rlData._id) model.isNew = false;
      try {
        const result = (await model.save()).toObject();
        results.push(result);
      } catch (ex) {
        Logger.error("Error saving CombinedRealtimeData, skipping.");
        Logger.verbose("", ex);
      }
    }
    return new CombinedRealtimeDataList(results);
  }

  async getEndpointLabelMap() {
    return (await EndpointLabelModel.findOne({}).exec())?.toJSON();
  }

  async insertEndpointLabelMap(labelMap: TEndpointLabel) {
    const model = new EndpointLabelModel(labelMap);
    return await model.save();
  }

  async deleteAllCombinedRealtimeData() {
    return await CombinedRealtimeDataModel.deleteMany({});
  }
  async deleteAllEndpointDependencies() {
    return await EndpointDependencyModel.deleteMany({});
  }
  async deleteAllEndpointDataType() {
    return await EndpointDataTypeModel.deleteMany({});
  }
  async deleteAllEndpointLabelMap() {
    return await EndpointLabelModel.deleteMany({});
  }

  async deleteCombinedRealtimeData(ids: Types.ObjectId[]) {
    return await CombinedRealtimeDataModel.deleteMany({
      _id: { $in: ids },
    });
  }
  async deleteEndpointDependencies(ids: Types.ObjectId[]) {
    return await EndpointDependencyModel.deleteMany({
      _id: { $in: ids },
    });
  }
  async deleteEndpointDataType(ids: Types.ObjectId[]) {
    return await EndpointDataTypeModel.deleteMany({
      _id: { $in: ids },
    });
  }
  async deleteEndpointLabel(ids: Types.ObjectId[]) {
    return await EndpointLabelModel.deleteMany({
      _id: { $in: ids },
    });
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

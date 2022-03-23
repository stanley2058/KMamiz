import IRequestHandler from "../entities/TRequestHandler";
import DataCache from "../services/DataCache";
import { TEndpointDataType } from "../entities/TEndpointDataType";
import { TEndpointLabel } from "../entities/TEndpointLabel";
import { TTaggedInterface } from "../entities/TTaggedInterface";
import MongoOperator from "../services/MongoOperator";
import { Types } from "mongoose";

export default class DataService extends IRequestHandler {
  constructor() {
    super("data");
    this.addRoute("get", "/aggregate/:namespace?", async (req, res) => {
      res.json(await this.getAggregateData(req.params["namespace"]));
    });
    this.addRoute("get", "/history/:namespace?", async (req, res) => {
      res.json(await this.getHistoryData(req.params["namespace"]));
    });
    this.addRoute("get", "/datatype/:uniqueLabelName", async (req, res) => {
      const labelName = decodeURIComponent(req.params["uniqueLabelName"]);
      if (!labelName) res.sendStatus(400);
      else {
        const result = await this.getEndpointDataType(labelName);
        if (result) res.json(result);
        else res.sendStatus(404);
      }
    });
    this.addRoute("get", "/label", async (_, res) => {
      res.json(this.getLabelMap());
    });
    this.addRoute("get", "/label/user", async (_, res) => {
      const userLabels = this.getUserDefinedLabel();
      if (userLabels) return res.json(userLabels);
      res.sendStatus(404);
    });
    this.addRoute("post", "/label/user", async (req, res) => {
      const labels = req.body as TEndpointLabel;
      if (!labels?.labels) return res.sendStatus(400);
      this.updateUserDefinedLabel(labels);
      res.sendStatus(201);
    });
    this.addRoute("delete", "/label/user", async (req, res) => {
      const label = req.body as {
        uniqueServiceName: string;
        method: string;
        label: string;
      };
      if (!label) return res.sendStatus(400);
      this.deleteUserDefinedLabel(
        label.uniqueServiceName,
        label.method,
        label.label
      );
      res.sendStatus(204);
    });
    this.addRoute("get", "/interface", async (req, res) => {
      const { uniqueLabelName } = req.query as {
        uniqueLabelName: string;
      };
      if (!uniqueLabelName) return res.sendStatus(400);
      res.json(
        await this.getTaggedInterface(decodeURIComponent(uniqueLabelName))
      );
    });
    this.addRoute("post", "/interface", async (req, res) => {
      const tagged = req.body as TTaggedInterface;
      if (!tagged) return res.sendStatus(400);
      await this.addTaggedInterface(tagged);
      res.sendStatus(201);
    });
    this.addRoute("delete", "/interface", async (req, res) => {
      const { id } = req.body as { id: string };
      if (!id) return res.sendStatus(400);
      const result = await this.deleteTaggedInterface(id);
      if (result) res.sendStatus(204);
      else res.sendStatus(400);
    });
  }

  async getAggregateData(namespace?: string) {
    return await DataCache.getInstance().getRealtimeAggregateData(namespace);
  }

  async getHistoryData(namespace?: string) {
    return await DataCache.getInstance().getRealtimeHistoryData(namespace);
  }

  async getEndpointDataType(
    uniqueLabelName: string
  ): Promise<TEndpointDataType | null> {
    const [service, namespace, version, method, label] =
      uniqueLabelName.split("\t");
    if (!method || !label) return null;

    const uniqueServiceName = `${service}\t${namespace}\t${version}`;
    const datatype = DataCache.getInstance().getEndpointDataTypesByLabel(
      label,
      uniqueServiceName,
      method
    );

    if (datatype.length === 0) return null;
    const merged = datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
    return { ...merged.toJSON(), labelName: label };
  }

  getLabelMap() {
    return [...DataCache.getInstance().labelMapping.entries()];
  }

  getUserDefinedLabel() {
    return DataCache.getInstance().userDefinedLabels;
  }

  updateUserDefinedLabel(label: TEndpointLabel) {
    DataCache.getInstance().updateUserDefinedLabel(label);
    DataCache.getInstance().updateLabel();
  }

  deleteUserDefinedLabel(
    uniqueServiceName: string,
    method: string,
    label: string
  ) {
    DataCache.getInstance().deleteUserDefinedLabel(
      label,
      uniqueServiceName,
      method
    );
    DataCache.getInstance().updateLabel();
  }

  async getTaggedInterface(uniqueLabelName: string) {
    return await MongoOperator.getInstance().getTaggedInterface(
      uniqueLabelName
    );
  }

  async addTaggedInterface(tagged: TTaggedInterface) {
    tagged._id = undefined;
    tagged.timestamp = Date.now();
    return await MongoOperator.getInstance().insertTaggedInterface(tagged);
  }

  async deleteTaggedInterface(id: string) {
    if (!id) return false;
    await MongoOperator.getInstance().deleteTaggedInterface(
      new Types.ObjectId(id)
    );
    return true;
  }
}

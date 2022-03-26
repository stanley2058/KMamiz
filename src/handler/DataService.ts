import IRequestHandler from "../entities/TRequestHandler";
import DataCache from "../services/DataCache";
import { TEndpointDataType } from "../entities/TEndpointDataType";
import { TEndpointLabel } from "../entities/TEndpointLabel";
import { TTaggedInterface } from "../entities/TTaggedInterface";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import ServiceUtils from "../services/ServiceUtils";

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
      res.json(this.getTaggedInterface(decodeURIComponent(uniqueLabelName)));
    });
    this.addRoute("post", "/interface", async (req, res) => {
      const tagged = req.body as TTaggedInterface;
      if (!tagged) return res.sendStatus(400);
      this.addTaggedInterface(tagged);
      res.sendStatus(201);
    });
    this.addRoute("delete", "/interface", async (req, res) => {
      const { uniqueLabelName, userLabel } = req.body as {
        uniqueLabelName: string;
        userLabel: string;
      };
      if (!uniqueLabelName || !userLabel) return res.sendStatus(400);
      this.deleteTaggedInterface(uniqueLabelName, userLabel);
      res.sendStatus(204);
    });
  }

  async getAggregateData(namespace?: string) {
    return await ServiceUtils.getInstance().getRealtimeAggregateData(namespace);
  }

  async getHistoryData(namespace?: string) {
    return await ServiceUtils.getInstance().getRealtimeHistoryData(namespace);
  }

  async getEndpointDataType(
    uniqueLabelName: string
  ): Promise<TEndpointDataType | null> {
    const [service, namespace, version, method, label] =
      uniqueLabelName.split("\t");
    if (!method || !label) return null;

    const uniqueServiceName = `${service}\t${namespace}\t${version}`;

    const datatype = DataCache.getInstance()
      .get<CLabelMapping>("LabelMapping")
      .getEndpointDataTypesByLabel(
        label,
        uniqueServiceName,
        method,
        DataCache.getInstance()
          .get<CEndpointDataType>("EndpointDataType")
          .getData() || []
      );

    if (datatype.length === 0) return null;
    const merged = datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
    return { ...merged.toJSON(), labelName: label };
  }

  getLabelMap() {
    const entries = DataCache.getInstance()
      .get<CLabelMapping>("LabelMapping")
      .getData()
      ?.entries();
    return entries ? [...entries] : [];
  }

  getUserDefinedLabel() {
    return DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .getData();
  }

  updateUserDefinedLabel(label: TEndpointLabel) {
    DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .update(label);
    ServiceUtils.getInstance().updateLabel();
  }

  deleteUserDefinedLabel(
    uniqueServiceName: string,
    method: string,
    label: string
  ) {
    DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .delete(label, uniqueServiceName, method);
    ServiceUtils.getInstance().updateLabel();
  }

  getTaggedInterface(uniqueLabelName: string) {
    return DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .getData(uniqueLabelName);
  }

  addTaggedInterface(tagged: TTaggedInterface) {
    DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .add(tagged);
  }

  deleteTaggedInterface(uniqueLabelName: string, userLabel: string) {
    DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .delete(uniqueLabelName, userLabel);
  }
}

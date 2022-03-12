import IRequestHandler from "../entities/TRequestHandler";
import DataCache from "../services/DataCache";
import { TEndpointDataType } from "../entities/TEndpointDataType";

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
    const [, , , method, label] = uniqueLabelName.split("\t");
    if (!method || !label) return null;

    const datatype = DataCache.getInstance().getEndpointDataTypesByLabel(label);

    if (datatype.length === 0) return null;
    const merged = datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
    return { ...merged.toJSON(), labelName: label };
  }
}

import IRequestHandler from "../entities/IRequestHandler";
import MongoOperator from "../services/MongoOperator";
import RealtimeDataService from "../services/RealtimeDataService";

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
    return await RealtimeDataService.getInstance().getRealtimeAggregateData(
      namespace
    );
  }

  async getHistoryData(namespace?: string) {
    return await RealtimeDataService.getInstance().getRealtimeHistoryData(
      namespace
    );
  }

  async getEndpointDataType(uniqueLabelName: string) {
    const [service, namespace, version, method, label] =
      uniqueLabelName.split("\t");
    if (!method || !label) return null;
    const datatype =
      await MongoOperator.getInstance().getEndpointDataTypeByLabel(
        `${service}\t${namespace}\t${version}`,
        method,
        label
      );

    if (datatype.length === 0) return null;
    const merged = datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
    return merged.endpointDataType;
  }
}

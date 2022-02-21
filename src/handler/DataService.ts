import IRequestHandler from "../entities/IRequestHandler";
import MongoOperator from "../services/MongoOperator";

export default class DataService extends IRequestHandler {
  constructor() {
    super("data");
    this.addRoute("get", "/aggregate/:namespace", async (req, res) => {
      res.json(await this.getAggregateData(req.params["namespace"]));
    });
    this.addRoute("get", "/history/:namespace", async (req, res) => {
      res.json(await this.getHistoryData(req.params["namespace"]));
    });
    this.addRoute("get", "/datatype/:uniqueLabelName", async (req, res) => {
      res.json(
        await this.getEndpointDataType(
          decodeURIComponent(req.params["uniqueLabelName"])
        )
      );
    });
  }

  async getAggregateData(namespace?: string) {
    return await MongoOperator.getInstance().getAggregateData(namespace);
  }

  async getHistoryData(namespace?: string) {
    return await MongoOperator.getInstance().getHistoryData(namespace);
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

    return datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
  }
}

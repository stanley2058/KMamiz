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
  }

  async getAggregateData(namespace?: string) {
    return await MongoOperator.getInstance().getAggregateData(namespace);
  }

  async getHistoryData(namespace?: string) {
    return await MongoOperator.getInstance().getHistoryData(namespace);
  }
}

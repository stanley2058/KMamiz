import IRequestHandler from "../entities/IRequestHandler";

export default class DataService extends IRequestHandler {
  constructor() {
    super("data");
    this.addRoute("get", "/", (req, res) => {
      res.sendStatus(200);
    });
  }
}

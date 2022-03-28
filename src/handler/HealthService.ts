import IRequestHandler from "../entities/TRequestHandler";

export default class HealthService extends IRequestHandler {
  constructor() {
    super("health");
    this.addRoute("get", "/", (_, res) => {
      res.json({
        status: "UP",
        serverTime: Date.now(),
      });
    });
  }
}

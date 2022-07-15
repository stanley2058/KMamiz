import { Router } from "express";
import cacheControl from "express-cache-controller";
import GlobalSettings from "../GlobalSettings";
import * as Handlers from "../handler";
import Logger from "../utils/Logger";

export default class Routes {
  private static instance?: Routes;
  static getInstance = () => this.instance || (this.instance = new this());

  private readonly router = Router();
  private readonly apiPrefix: string;

  private constructor() {
    this.apiPrefix = `/api/v${GlobalSettings.ApiVersion}`;
    this.router.use(cacheControl({ maxAge: 5 }));
    this.setRoutes();
  }

  private setRoutes() {
    Logger.verbose("Registered routes:");
    Object.values(Handlers).forEach((h) => {
      new h().getRoutes().forEach(({ method, path, handler }) => {
        const apiPath = `${this.apiPrefix}${path}`;
        this.router[method](apiPath, handler);
        Logger.plain.verbose(`[${method.toUpperCase()}]\t${apiPath}`);
      });
    });
  }

  getRoutes() {
    return this.router;
  }
}

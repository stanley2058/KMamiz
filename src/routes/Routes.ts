import { Router } from "express";
import GlobalSettings from "../GlobalSettings";

export default class Routes {
  private static instance?: Routes;
  static getInstance = () => this.instance || (this.instance = new this());

  private router = Router();
  private apiPrefix: string;
  private externalApiPrefix: string;
  private internalApiPrefix: string;
  private openApiPrefix: string;

  private constructor() {
    this.apiPrefix = `/api/v${GlobalSettings.ApiVersion}`;
    this.externalApiPrefix = `/pricing/external${this.apiPrefix}`;
    this.internalApiPrefix = `/pricing/internal${this.apiPrefix}`;
    this.openApiPrefix = `/pricing/open${this.apiPrefix}`;
    this.setRoutes();
  }

  private setRoutes() {}

  getRoutes() {
    return this.router;
  }
}

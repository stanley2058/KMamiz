import { Request, Response } from "express";
import { TRequestTypeLower } from "./TRequestType";

export default abstract class IRequestHandler {
  private readonly identifier: string;
  protected readonly routes: {
    method: TRequestTypeLower;
    path: string;
    handler: (req: Request, res: Response) => void;
  }[] = [];

  constructor(identifier: string = "") {
    this.identifier = identifier;
  }

  protected addRoute(
    method: TRequestTypeLower,
    path: string,
    handler: (req: Request, res: Response) => void
  ) {
    this.routes.push({ method, path: `/${this.identifier}${path}`, handler });
  }

  getRoutes() {
    return this.routes;
  }
}

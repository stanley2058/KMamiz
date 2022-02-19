import { Request, Response } from "express";
import { IRequestTypeLower } from "./IRequestType";

export default abstract class IRequestHandler {
  private readonly identifier: string;
  protected readonly routes: {
    method: IRequestTypeLower;
    path: string;
    handler: (req: Request, res: Response) => void;
  }[] = [];

  constructor(identifier: string = "") {
    this.identifier = identifier;
  }

  protected addRoute(
    method: IRequestTypeLower,
    path: string,
    handler: (req: Request, res: Response) => void
  ) {
    this.routes.push({ method, path: `/${this.identifier}${path}`, handler });
  }

  getRoutes() {
    return this.routes;
  }
}

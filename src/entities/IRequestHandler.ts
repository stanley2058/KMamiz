import { Request, Response } from "express";

type RequestType =
  | "get"
  | "head"
  | "post"
  | "put"
  | "delete"
  | "connect"
  | "options"
  | "trace"
  | "patch";
export default abstract class IRequestHandler {
  private readonly identifier: string;
  protected readonly routes: {
    method: RequestType;
    path: string;
    handler: (req: Request, res: Response) => void;
  }[] = [];

  constructor(identifier: string = "") {
    this.identifier = identifier;
  }

  protected addRoute(
    method: RequestType,
    path: string,
    handler: (req: Request, res: Response) => void
  ) {
    this.routes.push({ method, path: `/${this.identifier}${path}`, handler });
  }

  getRoutes() {
    return this.routes;
  }
}

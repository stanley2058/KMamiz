import { IRequestTypeUpper } from "./IRequestType";

export interface IEnvoyLog {
  namespace: string;
  podName: string;
  timestamp: Date;
  type: "Request" | "Response";
  requestId: string;
  traceId?: string;
  path?: string;
  method?: IRequestTypeUpper;
  status?: string;
  body?: string;
}

export interface IStructuredEnvoyLog {
  requestId: string;
  traces: IStructuredEnvoyLogTrace[];
}

export interface IStructuredEnvoyLogTrace {
  traceId: string;
  request: IEnvoyLog;
  response: IEnvoyLog;
}

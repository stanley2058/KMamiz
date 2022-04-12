import { TRequestTypeUpper } from "./TRequestType";

export type TEnvoyLog = {
  namespace: string;
  podName: string;
  timestamp: Date;
  type: "Request" | "Response";
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  path?: string;
  method?: TRequestTypeUpper;
  status?: string;
  body?: string;
  contentType?: string;
};

export type TStructuredEnvoyLog = {
  requestId: string;
  traces: TStructuredEnvoyLogTrace[];
};

export type TStructuredEnvoyLogTrace = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  request: TEnvoyLog;
  response: TEnvoyLog;
  isFallback: boolean;
};

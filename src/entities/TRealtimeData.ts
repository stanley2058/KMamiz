import { TRequestTypeUpper } from "./TRequestType";

export type TRealtimeData = {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  timestamp: number; // zipkin timestamp in microseconds
  method: TRequestTypeUpper;
  service: string;
  namespace: string;
  version: string;
  latency: number;
  status: string;
  responseBody?: string;
  responseContentType?: string;
  requestBody?: string;
  requestContentType?: string;
  replica?: number;
};

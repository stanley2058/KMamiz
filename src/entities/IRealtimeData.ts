import { IRequestTypeUpper } from "./IRequestType";

export interface IRealtimeData {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  timestamp: number; // zipkin timestamp in microseconds
  method: IRequestTypeUpper;
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
}

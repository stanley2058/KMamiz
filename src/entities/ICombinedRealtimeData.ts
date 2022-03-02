import { Types } from "mongoose";
import { IRequestTypeUpper } from "./IRequestType";

export interface ICombinedRealtimeData {
  _id?: Types.ObjectId;
  uniqueServiceName: string;
  uniqueEndpointName: string;
  latestTimestamp: number;
  method: IRequestTypeUpper;
  service: string;
  namespace: string;
  version: string;
  avgLatency: number;
  latencies: number[];
  status: string;
  combined: number;
  responseBody?: any;
  responseSchema?: string;
  responseContentType?: string;
  requestBody?: any;
  requestSchema?: string;
  requestContentType?: string;
  avgReplica?: number;
}

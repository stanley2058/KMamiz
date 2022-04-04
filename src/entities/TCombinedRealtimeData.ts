import { Types } from "mongoose";
import { TRequestTypeUpper } from "./TRequestType";

export type TCombinedRealtimeData = {
  _id?: Types.ObjectId;
  uniqueServiceName: string;
  uniqueEndpointName: string;
  latestTimestamp: number;
  method: TRequestTypeUpper;
  service: string;
  namespace: string;
  version: string;
  latency: {
    mean: number;
    divBase: number;
    cv: number;
  };
  status: string;
  combined: number;
  responseBody?: any;
  responseSchema?: string;
  responseContentType?: string;
  requestBody?: any;
  requestSchema?: string;
  requestContentType?: string;
  avgReplica?: number;
};

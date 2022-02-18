import { Types } from "mongoose";

export default interface IAggregateData {
  _id?: Types.ObjectId;
  fromDate: Date;
  toDate: Date;
  services: IAggregateServiceInfo[];
}

export interface IAggregateServiceInfo {
  service: string;
  namespace: string;
  version: string;
  totalRequests: number;
  totalServerErrors: number;
  totalRequestErrors: number;
  avgRisk: number;
  avgLatencyCV: number;
  endpoints: IAggregateEndpointInfo[];
}
export interface IAggregateEndpointInfo {
  name: string;
  protocol: string;
  totalRequests: number;
  totalServerErrors: number;
  totalRequestErrors: number;
  avgLatencyCV: number;
}

import { Types } from "mongoose";
import { IRequestTypeUpper } from "./IRequestType";

export default interface IAggregateData {
  _id?: Types.ObjectId;
  fromDate: Date;
  toDate: Date;
  services: IAggregateServiceInfo[];
}

export interface IAggregateServiceInfo {
  uniqueServiceName: string;
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
  uniqueServiceName: string;
  labelName: string;
  method: IRequestTypeUpper;
  totalRequests: number;
  totalServerErrors: number;
  totalRequestErrors: number;
  avgLatencyCV: number;
}

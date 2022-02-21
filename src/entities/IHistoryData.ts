import { Types } from "mongoose";
import { IRequestTypeUpper } from "./IRequestType";

export default interface IHistoryData {
  _id?: Types.ObjectId;
  date: Date;
  services: IHistoryServiceInfo[];
}

export interface IHistoryServiceInfo {
  uniqueServiceName: string;
  date: Date;
  service: string;
  namespace: string;
  version: string;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  risk?: number;
  latencyCV: number;
  endpoints: IHistoryEndpointInfo[];
}

export interface IHistoryEndpointInfo {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  labelName: string;
  method: IRequestTypeUpper;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
}

import { Types } from "mongoose";

export default interface IHistoryData {
  _id?: Types.ObjectId;
  date: Date;
  services: IHistoryServiceInfo[];
}

export interface IHistoryServiceInfo {
  _id?: Types.ObjectId;
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
  name: string;
  protocol: string;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
}

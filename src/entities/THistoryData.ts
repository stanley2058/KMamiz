import { Types } from "mongoose";
import { TRequestTypeUpper } from "./TRequestType";

export type THistoryData = {
  _id?: Types.ObjectId;
  date: Date;
  services: THistoryServiceInfo[];
};

export type THistoryServiceInfo = {
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
  endpoints: THistoryEndpointInfo[];
};

export type THistoryEndpointInfo = {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  labelName?: string;
  method: TRequestTypeUpper;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
};

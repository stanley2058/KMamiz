import { Types } from "mongoose";
import { TRequestTypeUpper } from "./TRequestType";

export type THistoricalData = {
  _id?: Types.ObjectId;
  date: Date;
  services: THistoricalServiceInfo[];
};

export type THistoricalServiceInfo = {
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
  endpoints: THistoricalEndpointInfo[];
};

export type THistoricalEndpointInfo = {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  labelName?: string;
  method: TRequestTypeUpper;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
};

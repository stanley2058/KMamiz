import { Types } from "mongoose";
import { TRequestTypeUpper } from "./TRequestType";

export type TEndpointDependency = {
  _id?: Types.ObjectId;
  endpoint: TEndpointInfo;
  dependingOn: {
    endpoint: TEndpointInfo;
    distance: number;
    type: "SERVER";
  }[];
  dependingBy: {
    endpoint: TEndpointInfo;
    distance: number;
    type: "CLIENT";
  }[];
};

export type TEndpointInfo = {
  uniqueServiceName: string;
  uniqueEndpointName: string;
  // trace name, label
  labelName?: string;
  service: string;
  namespace: string;
  version: string;
  // "http.url", true request url
  url: string;
  // host, path, port are from "http.url"
  host: string;
  path: string;
  port: string;
  method: TRequestTypeUpper;
  clusterName: string;
};

export type TEndpointDependencyCombined = {
  endpoint: TEndpointInfo;
  distance: number;
  type: "SERVER" | "CLIENT";
};

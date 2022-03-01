import { Types } from "mongoose";
import { IRequestTypeUpper } from "./IRequestType";

export interface IEndpointDependency {
  _id?: Types.ObjectId;
  endpoint: IEndpointInfo;
  dependsOn: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "SERVER";
  }[];
  dependBy: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "CLIENT";
  }[];
}

export interface IEndpointInfo {
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
  method: IRequestTypeUpper;
  clusterName: string;
}

export type TEndpointDependency = {
  endpoint: IEndpointInfo;
  distance: number;
  type: "SERVER" | "CLIENT";
};

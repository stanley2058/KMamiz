import { Types } from "mongoose";
import { TEndpointDependency } from "./TEndpointDependency";

export type TServiceDependency = {
  _id?: Types.ObjectId;
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
  dependency: TEndpointDependency[];
  links: TServiceLink[];
};

export type TServiceLink = TServiceLinkInfo & {
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
};
export type TServiceLinkInfo = {
  distance: number;
  count: number;
  dependingBy: number;
  dependingOn: number;
};

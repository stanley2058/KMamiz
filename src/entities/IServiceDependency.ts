import { Types } from "mongoose";
import { IEndpointDependency } from "./IEndpointDependency";

export default interface IServiceDependency {
  _id?: Types.ObjectId;
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
  dependency: IEndpointDependency[];
  links: IServiceLink[];
}

export type IServiceLink = IServiceLinkInfo & {
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
};
export type IServiceLinkInfo = {
  distance: number;
  count: number;
  dependBy: number;
  dependsOn: number;
};

import { Types } from "mongoose";
import { IEndpointDependency } from "./IEndpointDependency";

export default interface IServiceDependency {
  _id?: Types.ObjectId;
  service: string;
  namespace: string;
  version: string;
  dependency: IEndpointDependency[];
  links: IServiceLink[];
}

export type IServiceLink = IServiceLinkInfo & {
  service: string;
  namespace: string;
  version: string;
};
export type IServiceLinkInfo = {
  distance: number;
  count: number;
  linkedTo: number;
  linkedBy: number;
};

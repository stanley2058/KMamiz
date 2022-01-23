import { Types } from "mongoose";
import { IEndpointDependency } from "./IEndpointDependency";

export default interface IServiceDependency {
  _id?: Types.ObjectId;
  service: string;
  namespace: string;
  version: string;
  dependency: IEndpointDependency[];
  links: {
    service: string;
    namespace: string;
    version: string;
    distance: number;
    count: number;
  }[];
}

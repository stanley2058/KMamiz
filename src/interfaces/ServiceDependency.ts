import { Types } from "mongoose";
import EndpointDependency from "./EndpointDependency";

export default interface ServiceDependency {
  _id?: Types.ObjectId;
  service: string;
  namespace: string;
  version: string;
  dependency: EndpointDependency[];
  links: {
    service: string;
    namespace: string;
    version: string;
    distance: number;
    count: number;
  }[];
}

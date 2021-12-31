import { Types } from "mongoose";
import EndpointDependency from "./EndpointDependency";

export default interface ServiceDependency {
  _id?: Types.ObjectId;
  service: string;
  dependency: EndpointDependency[];
  links: {
    target: string;
    links: {
      distance: number;
      count: number;
    }[];
  }[];
}

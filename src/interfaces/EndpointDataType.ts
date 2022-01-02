import { Types } from "mongoose";

export default interface EndpointDataType {
  _id?: Types.ObjectId;
  service: string;
  namespace: string;
  version: string;
  endpoint: string;
  schemas: {
    time: Date;
    sampleObject: any;
    schema: string;
  }[];
}

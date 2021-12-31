import { Types } from "mongoose";

export default interface EndpointDataType {
  _id?: Types.ObjectId;
  serviceName: string;
  serviceVersion: string;
  endpointName: string;
  schemas: {
    time: Date;
    sampleObject: any;
    schema: string;
  }[];
}

import { Types } from "mongoose";
import { IRequestTypeUpper } from "./IRequestType";

export default interface IEndpointDataType {
  _id?: Types.ObjectId;
  uniqueServiceName: string;
  uniqueEndpointName: string;
  service: string;
  namespace: string;
  version: string;
  labelName: string;
  method: IRequestTypeUpper;
  schemas: IEndpointDataSchema[];
}

export interface IEndpointDataSchema {
  time: Date;
  status: string;
  responseSample: any;
  responseSchema: string;
  requestSample?: any;
  requestSchema?: string;
}

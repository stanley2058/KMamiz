import { Types } from "mongoose";

export default interface RealtimeData {
  _id: Types.ObjectId;
  time: Date;
  serviceName: string;
  serviceVersion: string;
  endpointName: string;
  latency: number;
  status: string;
  errorRequestBody?: any;
  errorResponseBody?: any;
}

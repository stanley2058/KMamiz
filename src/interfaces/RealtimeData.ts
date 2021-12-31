import { Types } from "mongoose";

export default interface RealtimeData {
  _id?: Types.ObjectId;
  timestamp: number;
  protocol: string;
  serviceName: string;
  serviceVersion: string;
  endpointName: string;
  latency: number;
  status: string;
  body?: string;
}

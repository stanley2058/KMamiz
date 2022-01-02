import { Types } from "mongoose";

export default interface RealtimeData {
  _id?: Types.ObjectId;
  timestamp: number; // zipkin timestamp in microseconds
  protocol: string;
  name: string;
  namespace: string;
  version: string;
  endpointName: string;
  latency: number;
  status: string;
  body?: string;
}

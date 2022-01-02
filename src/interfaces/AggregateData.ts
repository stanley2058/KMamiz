import { Types } from "mongoose";

export default interface AggregateData {
  _id?: Types.ObjectId;
  fromDate: Date;
  toDate: Date;
  services: {
    name: string;
    namespace: string;
    version: string;
    totalRequests: number;
    totalServerErrors: number;
    totalRequestErrors: number;
    avgRisk: number;
  }[];
}

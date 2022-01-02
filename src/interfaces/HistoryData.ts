import { Types } from "mongoose";

export default interface HistoryData {
  _id?: Types.ObjectId;
  date: Date;
  services: {
    name: string;
    namespace: string;
    version: string;
    requests: number;
    serverErrors: number;
    requestErrors: number;
    risk?: number;
  }[];
}

import { Types } from "mongoose";

export default interface IHistoryData {
  _id?: Types.ObjectId;
  date: Date;
  services: {
    service: string;
    namespace: string;
    version: string;
    requests: number;
    serverErrors: number;
    requestErrors: number;
    risk?: number;
  }[];
}

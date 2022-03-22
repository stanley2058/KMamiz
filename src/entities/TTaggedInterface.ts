import { Types } from "mongoose";

export type TTaggedInterface = {
  _id?: Types.ObjectId;
  uniqueLabelName: string;
  userLabel: string;
  timestamp?: number;
  interface: string;
};

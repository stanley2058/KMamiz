import { Types } from "mongoose";
import { TRequestTypeUpper } from "./TRequestType";

export type TTaggedInterface = {
  _id?: Types.ObjectId;
  labelName: string;
  userLabel: string;
  method: TRequestTypeUpper;
  timestamp?: number;
  interface: string;
};

import { Types } from "mongoose";

export type TTaggedSwagger = {
  _id?: Types.ObjectId;
  tag: string;
  time?: number;
  uniqueServiceName: string;
  openApiDocument: string; // json string
};

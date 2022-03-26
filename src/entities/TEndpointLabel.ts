import { Types } from "mongoose";

export type TEndpointLabel = {
  _id?: Types.ObjectId;
  labels: TEndpointLabelType[];
};

export type TEndpointLabelType = {
  uniqueServiceName: string;
  method: string;
  label: string;
  samples: string[];
  block?: boolean;
};

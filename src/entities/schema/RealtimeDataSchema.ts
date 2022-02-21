import { Schema, model } from "mongoose";
import { IRealtimeData } from "../IRealtimeData";

export const RealtimeDataSchema = new Schema<IRealtimeData>({
  uniqueServiceName: { type: String, required: true },
  uniqueEndpointName: { type: String, required: true },
  timestamp: { type: Number, required: true },
  method: { type: String, required: true },
  service: { type: String, required: true },
  namespace: { type: String, required: true },
  version: { type: String, required: true },
  labelName: { type: String, required: true },
  latency: { type: Number, required: true },
  status: { type: String, required: true },
  responseBody: { type: String },
  requestBody: { type: String },
  replica: { type: Number },
});

export const RealtimeDataModel = model<IRealtimeData>(
  "RealtimeData",
  RealtimeDataSchema
);

import { Schema, model } from "mongoose";
import { TCombinedRealtimeData } from "../TCombinedRealtimeData";

export const CombinedRealtimeDataSchema = new Schema<TCombinedRealtimeData>({
  uniqueServiceName: { type: String, required: true },
  uniqueEndpointName: { type: String, required: true },
  latestTimestamp: { type: Number, required: true },
  method: { type: String, required: true },
  service: { type: String, required: true },
  namespace: { type: String, required: true },
  version: { type: String, required: true },
  avgLatency: { type: Number, required: true },
  latencies: [{ type: Number, required: true }],
  status: { type: String, required: true },
  combined: { type: Number, required: true },
  responseBody: { type: Schema.Types.Mixed },
  responseContentType: { type: String },
  responseSchema: { type: String },
  requestBody: { type: Schema.Types.Mixed },
  requestContentType: { type: String },
  requestSchema: { type: String },
  avgReplica: { type: Number },
});

export const CombinedRealtimeDataModel = model<TCombinedRealtimeData>(
  "CombinedRealtimeData",
  CombinedRealtimeDataSchema
);

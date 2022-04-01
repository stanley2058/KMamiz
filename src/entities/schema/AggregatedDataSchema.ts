import { Schema, model } from "mongoose";
import { TAggregatedData } from "../TAggregatedData";

export const AggregatedDataSchema = new Schema<TAggregatedData>({
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  services: [
    {
      uniqueServiceName: { type: String, required: true },
      service: { type: String, required: true },
      namespace: { type: String, required: true },
      version: { type: String, required: true },
      totalRequests: { type: Number, required: true },
      totalServerErrors: { type: Number, required: true },
      totalRequestErrors: { type: Number, required: true },
      avgRisk: { type: Number, required: true },
      avgLatencyCV: { type: Number, required: true },
      endpoints: [
        {
          uniqueServiceName: { type: String, required: true },
          uniqueEndpointName: { type: String, required: true },
          method: { type: String, required: true },
          totalRequests: { type: Number, required: true },
          totalServerErrors: { type: Number, required: true },
          totalRequestErrors: { type: Number, required: true },
          avgLatencyCV: { type: Number, required: true },
        },
      ],
    },
  ],
});

export const AggregatedDataModel = model<TAggregatedData>(
  "AggregatedData",
  AggregatedDataSchema
);

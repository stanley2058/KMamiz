import { Schema, model } from "mongoose";
import { TEndpointLabel } from "../TEndpointLabel";

export const EndpointLabelSchema = new Schema<TEndpointLabel>({
  labels: [
    {
      uniqueServiceName: { type: String, required: true },
      method: { type: String, required: true },
      label: { type: String, required: true },
      samples: [{ type: String, required: true }],
      block: { type: Boolean },
    },
  ],
});

export const EndpointLabelModel = model<TEndpointLabel>(
  "EndpointLabel",
  EndpointLabelSchema
);

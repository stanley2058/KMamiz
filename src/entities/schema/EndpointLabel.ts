import { Schema, model } from "mongoose";
import { TEndpointLabel } from "../TEndpointLabel";

export const EndpointLabelSchema = new Schema<TEndpointLabel>({
  labels: [
    {
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

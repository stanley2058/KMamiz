import { Schema, model } from "mongoose";
import { TTaggedInterface } from "../TTaggedInterface";

export const TaggedInterfaceSchema = new Schema<TTaggedInterface>({
  uniqueLabelName: { type: String, required: true },
  userLabel: { type: String, required: true },
  requestSchema: { type: String, required: true },
  responseSchema: { type: String, required: true },
  timestamp: { type: Number, required: true },
});

export const TaggedInterfaceModel = model<TTaggedInterface>(
  "TaggedInterface",
  TaggedInterfaceSchema
);

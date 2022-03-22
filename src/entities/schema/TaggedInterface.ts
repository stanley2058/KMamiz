import { Schema, model } from "mongoose";
import { TTaggedInterface } from "../TTaggedInterface";

export const TaggedInterfaceSchema = new Schema<TTaggedInterface>({
  labelName: { type: String, required: true },
  userLabel: { type: String, required: true },
  method: { type: String, required: true },
  interface: { type: String, required: true },
  timestamp: { type: Number, required: true },
});

export const TaggedInterfaceModel = model<TTaggedInterface>(
  "TaggedInterface",
  TaggedInterfaceSchema
);

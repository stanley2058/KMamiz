import { Schema, model } from "mongoose";
import { TTaggedSwagger } from "../TTaggedSwagger";

export const TaggedSwaggerSchema = new Schema<TTaggedSwagger>({
  tag: { type: String, required: true },
  time: { type: Number, required: true },
  uniqueServiceName: { type: String, required: true },
  openApiDocument: { type: String, required: true },
});

export const TaggedSwaggerModel = model<TTaggedSwagger>(
  "TaggedSwagger",
  TaggedSwaggerSchema
);

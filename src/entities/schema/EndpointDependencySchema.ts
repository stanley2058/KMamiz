import { Schema, SchemaDefinitionProperty, model } from "mongoose";
import { IEndpointDependency, IEndpointInfo } from "../IEndpointDependency";

export const EndpointInfoSchema: SchemaDefinitionProperty<IEndpointInfo> = {
  uniqueServiceName: { type: String, required: true },
  uniqueEndpointName: { type: String, required: true },
  labelName: { type: String, required: true },
  service: { type: String, required: true },
  namespace: { type: String, required: true },
  version: { type: String, required: true },
  url: { type: String, required: true },
  host: { type: String, required: true },
  path: { type: String, required: true },
  port: { type: String, required: true },
  method: { type: String, required: true },
  clusterName: { type: String, required: true },
};

export const EndpointDependencySchema = new Schema<IEndpointDependency>({
  endpoint: EndpointInfoSchema,
  dependsOn: [
    {
      endpoint: EndpointInfoSchema,
      distance: { type: Number, required: true },
      type: { type: String, required: true },
    },
  ],
  dependBy: [
    {
      endpoint: EndpointInfoSchema,
      distance: { type: Number, required: true },
      type: { type: String, required: true },
    },
  ],
});

export const EndpointDependencyModel = model<IEndpointDependency>(
  "EndpointDependency",
  EndpointDependencySchema
);
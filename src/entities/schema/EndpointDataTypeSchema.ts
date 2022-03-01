import { Schema, model } from "mongoose";
import IEndpointDataType from "../IEndpointDataType";

export const EndpointDataTypeSchema = new Schema<IEndpointDataType>({
  uniqueServiceName: { type: String, required: true },
  uniqueEndpointName: { type: String, required: true },
  service: { type: String, required: true },
  namespace: { type: String, required: true },
  version: { type: String, required: true },
  method: { type: String, required: true },
  schemas: [
    {
      time: { type: Date, required: true },
      status: { type: String, required: true },
      responseSample: { type: Schema.Types.Mixed },
      responseContentType: { type: String },
      responseSchema: { type: String },
      requestSample: { type: Schema.Types.Mixed },
      requestContentType: { type: String },
      requestSchema: { type: String },
      requestParams: [
        {
          param: { type: String, required: true },
          type: { type: String, required: true },
        },
      ],
    },
  ],
});

export const EndpointDataTypeModel = model<IEndpointDataType>(
  "EndpointDataType",
  EndpointDataTypeSchema
);

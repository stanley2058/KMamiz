import { cursorTo } from "readline";
import IEndpointDataType, {
  IEndpointDataSchema,
  IEndpointRequestParam,
} from "../entities/IEndpointDataType";
import Utils from "../utils/Utils";

export default class EndpointDataType {
  private readonly _endpointDataType: IEndpointDataType;
  constructor(endpointDataType: IEndpointDataType) {
    this._endpointDataType = endpointDataType;
  }
  get endpointDataType() {
    return this._endpointDataType;
  }

  removeDuplicateSchemas() {
    const schemaMap = new Map<string, IEndpointDataSchema>();
    this._endpointDataType.schemas.forEach((s) => {
      const id = `${s.responseSchema || ""}\t${s.requestSchema || ""}`;
      schemaMap.set(id, s);
    });
    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: [...schemaMap.values()],
    });
  }

  mergeSchemaWith(endpointData: EndpointDataType) {
    const existingSchemas = this._endpointDataType.schemas;
    const newSchemas = endpointData._endpointDataType.schemas;

    const status = [
      ...existingSchemas.reduce(
        (prev, curr) => prev.add(curr.status),
        new Set<string>()
      ),
      ...newSchemas.reduce(
        (prev, curr) => prev.add(curr.status),
        new Set<string>()
      ),
    ];

    const combinedList = [...existingSchemas, ...newSchemas];
    const mergedSamples = status.map((s): IEndpointDataSchema => {
      const matched = combinedList.filter((sc) => sc.status === s);
      const first = matched[0];
      const last = matched[matched.length - 1];
      const responseSample = matched.reduce((prev, curr) => {
        if (Array.isArray(prev)) {
          return this.mergeArray(prev, curr.responseSample);
        }
        return this.mergeObject(prev, curr.responseSample);
      }, first.responseSample);
      const mergedRequests = matched.reduce((prev, curr) => {
        if (Array.isArray(prev)) {
          return this.mergeArray(prev, curr.requestSample);
        }
        return this.mergeObject(prev, curr.requestSample);
      }, first.requestSample);
      const requestSample =
        Object.keys(mergedRequests).length > 0 ? mergedRequests : undefined;
      const { time } = matched.reduce((prev, curr) =>
        prev.time > curr.time ? prev : curr
      );

      return {
        time,
        status: s,
        responseSample,
        responseSchema: responseSample
          ? Utils.ObjectToInterfaceString(responseSample)
          : undefined,
        responseContentType: last.responseContentType,
        requestSample,
        requestSchema: requestSample
          ? Utils.ObjectToInterfaceString(requestSample)
          : undefined,
        requestContentType: last.requestContentType,
        requestParams: Utils.UniqueParams(
          [...(matched.map((m) => m.requestParams)?.flat() || [])].filter(
            (m) => !!m
          ) as IEndpointRequestParam[]
        ),
      };
    });

    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: mergedSamples,
    });
  }
  private mergeObject(a: any, b: any) {
    return { ...a, ...b };
  }
  private mergeArray(a: any[], b: any[]) {
    return [...a, ...b];
  }
}

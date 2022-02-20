import IEndpointDataType, {
  IEndpointDataSchema,
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
    const schemaSet = new Set<string>(
      this._endpointDataType.schemas.map((s) => s.responseSchema)
    );
    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: [...schemaSet].map(
        (s) =>
          this._endpointDataType.schemas.find((sc) => sc.responseSchema === s)!
      ),
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
    const mergedSamples = status.map((s) => {
      const matched = combinedList.filter((sc) => sc.status === s);
      const responseSample = matched.reduce(
        (prev, curr) => ({ ...prev, ...curr.responseSample }),
        {}
      );
      const mergedRequests = matched.reduce(
        (prev, curr) => ({ ...prev, ...curr.requestSample }),
        {}
      );
      const requestSample =
        Object.keys(mergedRequests).length > 0 ? mergedRequests : undefined;
      const { time } = matched.reduce((prev, curr) =>
        prev.time > curr.time ? prev : curr
      );
      return {
        time,
        status: s,
        responseSample,
        responseSchema: Utils.ObjectToInterfaceString(responseSample),
        requestSample,
        requestSchema: requestSample
          ? Utils.ObjectToInterfaceString(requestSample)
          : undefined,
      };
    });

    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: mergedSamples,
    });
  }
}

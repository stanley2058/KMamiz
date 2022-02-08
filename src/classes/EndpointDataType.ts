import IEndpointDataType from "../entities/IEndpointDataType";
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
      this._endpointDataType.schemas.map((s) => s.schema)
    );
    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: [...schemaSet].map(
        (s) => this._endpointDataType.schemas.find((sc) => sc.schema === s)!
      ),
    });
  }

  mergeSchemaWith(endpointData: EndpointDataType) {
    const existingSchemas = this._endpointDataType.schemas;
    const newSchemas = endpointData._endpointDataType.schemas;
    const mergedSample = {
      ...existingSchemas[existingSchemas.length - 1].sampleObject,
      ...newSchemas[newSchemas.length - 1].sampleObject,
    };
    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: [
        ...existingSchemas,
        {
          time: new Date(),
          sampleObject: mergedSample,
          schema: Utils.ObjectToInterfaceString(mergedSample),
        },
      ],
    });
  }
}

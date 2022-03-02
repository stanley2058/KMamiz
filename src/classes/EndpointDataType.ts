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

  hasMatchedSchema(endpointData: EndpointDataType) {
    const thisSchemas = new Map<string, IEndpointDataSchema>();
    this._endpointDataType.schemas.forEach((s) => thisSchemas.set(s.status, s));
    const cmpSchemas = new Map<string, IEndpointDataSchema>();
    endpointData._endpointDataType.schemas.forEach((s) =>
      cmpSchemas.set(s.status, s)
    );

    const commonKeys = [...thisSchemas.keys()].filter((k) => cmpSchemas.has(k));
    let result = false;
    for (const k of commonKeys) {
      const tSchema = thisSchemas.get(k)!;
      const cSchema = cmpSchemas.get(k)!;
      if (!this.isSchemaMatched(tSchema, cSchema)) {
        return false;
      }
      if (tSchema.requestContentType || tSchema.responseContentType) {
        result = true;
      }
    }
    return result;
  }
  private isSchemaMatched(
    schemaA: IEndpointDataSchema,
    schemaB: IEndpointDataSchema
  ) {
    return (
      schemaA.requestContentType === schemaB.requestContentType &&
      schemaA.responseContentType === schemaB.responseContentType &&
      this.isInterfaceMatched(schemaA.requestSchema, schemaB.requestSchema) &&
      this.isInterfaceMatched(schemaA.responseSchema, schemaB.responseSchema)
    );
  }
  private isInterfaceMatched(interfaceA?: string, interfaceB?: string) {
    if (interfaceA && interfaceB) {
      const breakA = this.breakdownInterface(interfaceA);
      const breakB = this.breakdownInterface(interfaceB);
      const aMap = new Map<string, string>();
      breakA.forEach(([field, t]) => aMap.set(field, t));

      for (const [f, t] of breakB) {
        const exist = aMap.get(f);
        if (!exist || (exist !== t && exist !== "any" && t !== "any"))
          return false;
      }
      return true;
    }
    return interfaceA === interfaceB;
  }
  private breakdownInterface(interfaceStr: string) {
    const matched = interfaceStr
      .split("\n")
      .map((s) => s.match(/  ([^?:]*)[^ ]* ([^;]*)/))
      .map((m) => (m || []).slice(1))
      .filter((m) => m.length > 0);
    return matched;
  }

  mergeSchemaWith(endpointData: EndpointDataType) {
    const mapToMap = (schemas: IEndpointDataSchema[]) =>
      schemas
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .reduce((prev, curr) => {
          if (prev.has(curr.status)) return prev;
          return prev.set(curr.status, curr);
        }, new Map<string, IEndpointDataSchema>());
    const existingMap = mapToMap(this._endpointDataType.schemas);
    const newMap = mapToMap(endpointData._endpointDataType.schemas);

    const combinedMap = new Map<string, IEndpointDataSchema>();
    [...existingMap.entries()].forEach(([status, eSchema]) => {
      const nSchema = newMap.get(status);
      if (!nSchema) return;
      const requestParams = (eSchema.requestParams || []).concat(
        nSchema.requestParams || []
      );

      const requestSample = Utils.Merge(
        eSchema.requestSample,
        nSchema.requestSample
      );
      const responseSample = Utils.Merge(
        eSchema.responseSample,
        nSchema.responseSample
      );

      combinedMap.set(status, {
        status,
        time: new Date(),
        requestParams: Utils.UniqueParams(requestParams),
        requestSample,
        responseSchema: responseSample
          ? Utils.ObjectToInterfaceString(responseSample)
          : undefined,
        responseSample,
        requestSchema: requestSample
          ? Utils.ObjectToInterfaceString(requestSample)
          : undefined,
        requestContentType:
          eSchema.requestContentType || nSchema.requestContentType,
        responseContentType:
          eSchema.responseContentType || nSchema.responseContentType,
      });
    });
    return new EndpointDataType({
      ...this._endpointDataType,
      schemas: this._endpointDataType.schemas.concat([...combinedMap.values()]),
    });
  }
}

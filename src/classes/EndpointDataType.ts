import {
  TEndpointDataType,
  TEndpointDataSchema,
} from "../entities/TEndpointDataType";
import {
  TEndpointCohesion,
  TServiceCohesion,
} from "../entities/TServiceCohesion";
import Utils from "../utils/Utils";

export default class EndpointDataType {
  private readonly _endpointDataType: TEndpointDataType;
  constructor(endpointDataType: TEndpointDataType) {
    this._endpointDataType = endpointDataType;
  }

  toJSON() {
    return this._endpointDataType;
  }

  trim() {
    const dataType = this.removeDuplicateSchemas();
    const schemaMap = new Map<string, TEndpointDataSchema>();
    dataType._endpointDataType.schemas.forEach((s) => {
      const existing = schemaMap.get(s.status);
      if (existing) {
        s.requestContentType =
          existing.requestContentType || s.requestContentType;
        s.requestParams = (existing.requestParams || []).concat(
          s.requestParams || []
        );

        s.requestSample = Utils.Merge(existing.requestSample, s.requestSample);
        s.requestSchema = Utils.ObjectToInterfaceString(s.requestSample);

        s.responseContentType =
          existing.responseContentType || s.responseContentType;
        s.responseSample = Utils.Merge(
          existing.responseSample,
          s.responseSample
        );
        s.responseSchema = Utils.ObjectToInterfaceString(s.responseSample);
      }
      schemaMap.set(s.status, s);
    });

    dataType._endpointDataType.schemas = [...schemaMap.values()];
    return dataType;
  }

  removeDuplicateSchemas() {
    const schemaMap = new Map<string, TEndpointDataSchema>();
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
    const thisSchemas = new Map<string, TEndpointDataSchema>();
    this._endpointDataType.schemas.forEach((s) => thisSchemas.set(s.status, s));
    const cmpSchemas = new Map<string, TEndpointDataSchema>();
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
    schemaA: TEndpointDataSchema,
    schemaB: TEndpointDataSchema
  ) {
    return (
      schemaA.requestContentType === schemaB.requestContentType &&
      schemaA.responseContentType === schemaB.responseContentType &&
      this.isInterfaceMatched(schemaA.requestSchema, schemaB.requestSchema) &&
      this.isInterfaceMatched(schemaA.responseSchema, schemaB.responseSchema)
    );
  }
  private isInterfaceMatched(interfaceA?: string, interfaceB?: string) {
    if (interfaceA === undefined) interfaceA = "interface Root {\n}";
    if (interfaceB === undefined) interfaceB = "interface Root {\n}";
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
    const mapToMap = (schemas: TEndpointDataSchema[]) =>
      schemas
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .reduce((prev, curr) => {
          if (prev.has(curr.status)) return prev;
          return prev.set(curr.status, curr);
        }, new Map<string, TEndpointDataSchema>());
    const existingMap = mapToMap(this._endpointDataType.schemas);
    const newMap = mapToMap(endpointData._endpointDataType.schemas);

    const combinedMap = new Map<string, TEndpointDataSchema>();
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

  static GetServiceCohesion(dataTypes: EndpointDataType[]) {
    const dataTypeMapping = EndpointDataType.createDataTypeMapping(dataTypes);

    return [...dataTypeMapping.entries()].map(
      ([uniqueServiceName, endpoints]): TServiceCohesion => {
        const preprocessed = EndpointDataType.preprocessEndpoints(endpoints);
        const endpointCohesion: TEndpointCohesion[] =
          EndpointDataType.createEndpointCohesion(preprocessed);
        const sum = endpointCohesion.reduce((acc, ec) => acc + ec.score, 0);
        const cohesiveness =
          endpointCohesion.length > 0 ? sum / endpointCohesion.length : 0;

        return {
          uniqueServiceName,
          cohesiveness,
          endpointCohesion,
        };
      }
    );
  }

  private static createDataTypeMapping(dataTypes: EndpointDataType[]) {
    const dataTypeMapping = new Map<string, Map<string, EndpointDataType>>();
    dataTypes.forEach((d) => {
      const dType = d._endpointDataType;
      if (!dataTypeMapping.has(dType.uniqueServiceName)) {
        dataTypeMapping.set(
          dType.uniqueServiceName,
          new Map<string, EndpointDataType>()
        );
      }
      const serviceMap = dataTypeMapping.get(dType.uniqueServiceName)!;
      if (!serviceMap.has(dType.labelName!)) {
        serviceMap.set(dType.labelName!, d);
      } else {
        serviceMap.set(
          dType.labelName!,
          serviceMap.get(dType.labelName!)!.mergeSchemaWith(d)
        );
      }
    });
    return dataTypeMapping;
  }

  private static preprocessEndpoints(endpoints: Map<string, EndpointDataType>) {
    const preprocessed = [...endpoints.entries()].map(([endpointName, e]) => {
      const contentTypes = new Set<string>();
      const combined = e._endpointDataType.schemas.reduce(
        (prev, curr) => {
          if (curr.requestContentType === "application/json") {
            prev.request = { ...prev.request, ...curr.requestSample };
          } else if (curr.requestContentType) {
            contentTypes.add(curr.requestContentType);
          }

          if (curr.responseContentType === "application/json") {
            prev.request = { ...prev.request, ...curr.responseSample };
          } else if (curr.responseContentType) {
            contentTypes.add(curr.responseContentType);
          }
          return prev;
        },
        { request: {}, response: {} } as { request: any; response: any }
      );

      return {
        endpointName,
        contentTypes,
        requestSchema: Utils.MatchInterfaceFieldAndTrim(
          Utils.ObjectToInterfaceString(combined.request)
        ),
        responseSchema: Utils.MatchInterfaceFieldAndTrim(
          Utils.ObjectToInterfaceString(combined.response)
        ),
      };
    });
    return preprocessed;
  }

  private static createEndpointCohesion(
    preprocessed: {
      endpointName: string;
      contentTypes: Set<string>;
      requestSchema: Set<string>;
      responseSchema: Set<string>;
    }[]
  ) {
    const endpointCohesion: TEndpointCohesion[] = [];
    for (let i = 0; i < preprocessed.length - 1; i++) {
      const a = preprocessed[i];
      for (let j = i + 1; j < preprocessed.length; j++) {
        const b = preprocessed[j];
        const scores: number[] = [];

        const requestSim = EndpointDataType.cosineSim(
          a.requestSchema,
          b.requestSchema
        );
        const responseSim = EndpointDataType.cosineSim(
          a.responseSchema,
          b.responseSchema
        );
        const typeSim = EndpointDataType.cosineSim(
          a.contentTypes,
          b.contentTypes
        );

        if (requestSim) scores.push(requestSim);
        if (responseSim) scores.push(responseSim);
        if (typeSim) scores.push(typeSim);
        endpointCohesion.push({
          aName: a.endpointName,
          bName: b.endpointName,
          score:
            scores.length > 0
              ? scores.reduce((a, b) => a + b) / scores.length
              : 0,
        });
      }
    }
    return endpointCohesion;
  }
  private static cosineSim(setA: Set<string>, setB: Set<string>) {
    if (setA.size === 0 && setB.size === 0) return null;
    const based = [...new Set([...setA, ...setB])];
    return Utils.CosSim(
      Utils.CreateStandardVector(based, setA),
      Utils.CreateStandardVector(based, setB)
    );
  }
}

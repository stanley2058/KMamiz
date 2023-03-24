import { RealtimeDataList } from "../classes/RealtimeDataList";
import Utils from "../utils/Utils";
import { TCombinedRealtimeData } from "./TCombinedRealtimeData";
import { TEndpointDataType } from "./TEndpointDataType";
import { TEndpointDependency } from "./TEndpointDependency";
import { TRequestType, TRequestTypeUpper } from "./TRequestType";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type TExternalDataProcessorRequest = {
  uniqueId: string;
  lookBack: number; // u64
  time: number; // u64
  existingDep?: TEndpointDependency[];
};

export type TExternalDataProcessorResponse = {
  uniqueId: string;
  combined: TPartialCombinedRealtimeData[];
  dependencies: TEndpointDependency[];
  datatype: TPartialEndpointDataType[];
  log: string;
};

export type TPartialCombinedRealtimeData = {
  uniqueServiceName: string; // String
  uniqueEndpointName: string; // String
  latestTimestamp: number; // i64
  method: TRequestType; // RequestType
  service: string; // String
  namespace: string; // String
  version: string; // String
  latency: {
    mean: number; // f64
    divBase: number; // f64
    cv: number; // f64
  }; // CombinedLatency
  status: string; // String
  combined: number; // usize
  requestBody: string[]; // Vec<String>
  requestContentType?: string; // Option<String>
  responseBody: string[]; // Vec<String>
  responseContentType?: string; // Option<String>
  avgReplica: number; // f64
};

export type TPartialEndpointDataType = {
  uniqueServiceName: string; // String
  uniqueEndpointName: string; // String
  service: string; // String
  namespace: string; // String
  version: string; // String
  method: TRequestType; // RequestType
  schema: {
    time: number; // i64, millisecond
    status: string; // String
    requestSample: string[]; // Vec<String>
    responseSample: string[]; // Vec<String>
    requestContentType?: string; // Option<String>
    responseContentType?: string; // Option<String>
  };
};

function isDataType(
  data: TPartialCombinedRealtimeData[] | TPartialEndpointDataType[]
): data is TPartialEndpointDataType[] {
  const sample = data[0];
  return sample && Object.keys(sample).includes("schema");
}
function convert(data: TPartialCombinedRealtimeData[]): TCombinedRealtimeData[];
function convert(data: TPartialEndpointDataType[]): TEndpointDataType[];
function convert(
  data: TPartialCombinedRealtimeData[] | TPartialEndpointDataType[]
): TCombinedRealtimeData[] | TEndpointDataType[] {
  if (isDataType(data)) {
    return convertDataType(data);
  }
  return convertRlData(data);
}

function mergeObj(obj: string[]): unknown | undefined {
  return obj.reduce(
    (prev, curr) => Utils.Merge(prev, JSON.parse(curr)),
    undefined
  );
}

function convertRlData(
  data: TPartialCombinedRealtimeData[]
): TCombinedRealtimeData[] {
  return data.map((d) => {
    const combinedReq: any = mergeObj(d.requestBody);
    const combinedRes: any = mergeObj(d.responseBody);
    const schema = RealtimeDataList.parseRequestResponseBody({
      requestBody: JSON.stringify(combinedReq),
      requestContentType: d.requestContentType,
      responseBody: JSON.stringify(combinedRes),
      responseContentType: d.responseContentType,
    });

    return {
      ...d,
      method: d.method.toUpperCase() as TRequestTypeUpper,
      ...schema,
    };
  });
}

function convertDataType(
  data: TPartialEndpointDataType[]
): TEndpointDataType[] {
  return data.map((d) => {
    const combinedReq: any = mergeObj(d.schema.requestSample);
    const combinedRes: any = mergeObj(d.schema.responseSample);

    const tokens = d.uniqueEndpointName.split("\t");
    const requestParams = Utils.GetParamsFromUrl(tokens[tokens.length - 1]);

    const schema = RealtimeDataList.parseRequestResponseBody({
      requestBody: JSON.stringify(combinedReq),
      requestContentType: d.schema.requestContentType,
      responseBody: JSON.stringify(combinedRes),
      responseContentType: d.schema.responseContentType,
    });

    const data: PartialBy<TPartialEndpointDataType, "schema"> = d;
    delete data.schema;
    return {
      ...data,
      method: data.method.toUpperCase() as TRequestTypeUpper,
      schemas: [
        {
          status: d.schema.status,
          time: new Date(d.schema.time),
          requestParams,
          requestContentType: d.schema.requestContentType,
          responseContentType: d.schema.responseContentType,
          ...schema,
        },
      ],
    };
  });
}

export { convert };

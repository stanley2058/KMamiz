import Utils from "../utils/Utils";
import { IRealtimeData } from "../entities/IRealtimeData";
import { ICombinedRealtimeData } from "../entities/ICombinedRealtimeData";
import Logger from "../utils/Logger";
import CombinedRealtimeData from "./CombinedRealtimeData";

export class RealtimeData {
  private readonly _realtimeData: IRealtimeData[];
  constructor(realtimeData: IRealtimeData[]) {
    this._realtimeData = realtimeData;
  }
  get realtimeData() {
    return this._realtimeData;
  }

  getContainingNamespaces() {
    return new Set(this._realtimeData.map((r) => r.namespace));
  }

  toCombinedRealtimeData() {
    const uniqueNameMapping = new Map<string, IRealtimeData[]>();
    this._realtimeData.forEach((r) => {
      const id = r.uniqueEndpointName;
      uniqueNameMapping.set(id, (uniqueNameMapping.get(id) || []).concat([r]));
    });

    const combined = [...uniqueNameMapping.values()]
      .map((group): ICombinedRealtimeData[] => {
        const statusMap = new Map<string, IRealtimeData[]>();
        group.forEach((r) => {
          statusMap.set(r.status, (statusMap.get(r.status) || []).concat([r]));
        });
        const sample = group[0];
        const baseSample = {
          uniqueServiceName: sample.uniqueServiceName,
          uniqueEndpointName: sample.uniqueEndpointName,
          service: sample.service,
          namespace: sample.namespace,
          version: sample.version,
          method: sample.method,
        };

        const combinedSubGroup = [...statusMap.entries()].map(
          ([status, subGroup]): ICombinedRealtimeData => {
            const combined = subGroup.reduce((prev, curr) => {
              prev.latency += curr.latency;
              prev.requestBody = Utils.MergeStringBody(
                prev.requestBody,
                curr.requestBody
              );
              prev.responseBody = Utils.MergeStringBody(
                prev.responseBody,
                curr.responseBody
              );
              prev.timestamp =
                prev.timestamp > curr.timestamp
                  ? prev.timestamp
                  : curr.timestamp;
              if (prev.replica && curr.replica) prev.replica += curr.replica;
              return prev;
            });
            const { requestBody, requestSchema, responseBody, responseSchema } =
              this.parseRequestResponseBody(combined);

            return {
              ...baseSample,
              status,
              combined: subGroup.length,
              requestBody,
              requestSchema,
              responseBody,
              responseSchema,
              avgLatency: combined.latency / subGroup.length,
              avgReplica: combined.replica
                ? combined.replica / subGroup.length
                : undefined,
              latestTimestamp: combined.timestamp,
              latencies: subGroup.map((r) => r.latency),
            };
          }
        );
        return combinedSubGroup;
      })
      .flat();

    return new CombinedRealtimeData(combined);
  }

  private parseRequestResponseBody(data: IRealtimeData) {
    let requestBody: any | undefined;
    let requestSchema: string | undefined;
    let responseBody: any | undefined;
    let responseSchema: string | undefined;
    if (data.requestContentType === "application/json") {
      try {
        requestBody = JSON.parse(data.requestBody!);
        requestSchema = Utils.ObjectToInterfaceString(requestBody);
      } catch (e) {
        Logger.verbose(`Not a JSON, skipping: [${data.requestBody}]`);
        requestBody = requestSchema = undefined;
      }
    }
    if (data.responseContentType === "application/json") {
      try {
        responseBody = JSON.parse(data.responseBody!);
        responseSchema = Utils.ObjectToInterfaceString(responseBody);
      } catch (e) {
        Logger.verbose(`Not a JSON, skipping: [${data.responseBody}]`);
        responseBody = responseSchema = undefined;
      }
    }
    return {
      requestBody,
      requestSchema,
      responseBody,
      responseSchema,
    };
  }
}

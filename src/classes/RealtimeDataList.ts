import Utils from "../utils/Utils";
import { TRealtimeData } from "../entities/TRealtimeData";
import { TCombinedRealtimeData } from "../entities/TCombinedRealtimeData";
import Logger from "../utils/Logger";
import CombinedRealtimeDataList from "./CombinedRealtimeDataList";

export class RealtimeDataList {
  private readonly _realtimeData: TRealtimeData[];
  constructor(realtimeData: TRealtimeData[]) {
    this._realtimeData = realtimeData;
  }

  toJSON() {
    return this._realtimeData;
  }

  getContainingNamespaces() {
    return new Set(this._realtimeData.map((r) => r.namespace));
  }

  toCombinedRealtimeData() {
    const uniqueNameMapping = new Map<string, TRealtimeData[]>();
    this._realtimeData.forEach((r) => {
      const id = r.uniqueEndpointName;
      uniqueNameMapping.set(id, (uniqueNameMapping.get(id) || []).concat([r]));
    });

    const combined = [...uniqueNameMapping.values()]
      .map((group): TCombinedRealtimeData[] => {
        const statusMap = new Map<string, TRealtimeData[]>();
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
          ([status, subGroup]): TCombinedRealtimeData => {
            const combined = subGroup.reduce((prev, curr) => {
              const acc = { ...prev };
              acc.latency += curr.latency;
              acc.requestBody = Utils.MergeStringBody(
                acc.requestBody,
                curr.requestBody
              );
              acc.responseBody = Utils.MergeStringBody(
                acc.responseBody,
                curr.responseBody
              );
              acc.timestamp =
                acc.timestamp > curr.timestamp ? acc.timestamp : curr.timestamp;
              if (acc.replica && curr.replica) acc.replica += curr.replica;
              return acc;
            });
            const { requestBody, requestSchema, responseBody, responseSchema } =
              this.parseRequestResponseBody(combined);

            const latencyDivBase = Utils.ToPrecise(
              subGroup.reduce(
                (prev, curr) => prev + Math.pow(curr.latency, 2),
                0
              )
            );
            const latencyMean = Utils.ToPrecise(
              combined.latency / subGroup.length
            );
            const cv = Utils.ToPrecise(
              Math.sqrt(
                latencyDivBase / subGroup.length - Math.pow(latencyMean, 2)
              ) / latencyMean
            );

            return {
              ...baseSample,
              status,
              combined: subGroup.length,
              requestBody,
              requestSchema,
              responseBody,
              responseSchema,
              avgReplica: combined.replica
                ? combined.replica / subGroup.length
                : undefined,
              latestTimestamp: combined.timestamp,
              latency: {
                mean: latencyMean,
                divBase: latencyDivBase,
                cv,
              },
              requestContentType: combined.requestContentType,
              responseContentType: combined.responseContentType,
            };
          }
        );
        return combinedSubGroup;
      })
      .flat();

    return new CombinedRealtimeDataList(combined);
  }

  private parseRequestResponseBody(data: TRealtimeData) {
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

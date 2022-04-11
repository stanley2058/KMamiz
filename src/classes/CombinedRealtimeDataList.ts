import {
  TAggregatedData,
  TAggregatedEndpointInfo,
} from "../entities/TAggregatedData";
import { TCombinedRealtimeData } from "../entities/TCombinedRealtimeData";
import { TEndpointDataType } from "../entities/TEndpointDataType";
import {
  THistoricalData,
  THistoricalEndpointInfo,
  THistoricalServiceInfo,
} from "../entities/THistoricalData";
import { TReplicaCount } from "../entities/TReplicaCount";
import { TRequestTypeUpper } from "../entities/TRequestType";
import { TRiskResult } from "../entities/TRiskResult";
import { TServiceDependency } from "../entities/TServiceDependency";
import RiskAnalyzer from "../utils/RiskAnalyzer";
import Utils from "../utils/Utils";
import EndpointDataType from "./EndpointDataType";

export default class CombinedRealtimeDataList {
  private readonly _combinedRealtimeData: TCombinedRealtimeData[];
  constructor(combinedRealtimeData: TCombinedRealtimeData[]) {
    this._combinedRealtimeData = combinedRealtimeData;
  }

  toJSON() {
    return this._combinedRealtimeData;
  }

  toHistoricalData(
    serviceDependencies: TServiceDependency[],
    replicas: TReplicaCount[] = [],
    labelMap?: Map<string, string>
  ) {
    const dateMapping = new Map<number, TCombinedRealtimeData[]>();
    this._combinedRealtimeData.forEach((r) => {
      const time = Utils.BelongsToDateTimestamp(r.latestTimestamp / 1000);
      dateMapping.set(time, (dateMapping.get(time) || []).concat([r]));
    });

    return [...dateMapping.entries()].map(
      ([time, dailyData]): THistoricalData => {
        const risks = RiskAnalyzer.RealtimeRisk(
          dailyData,
          serviceDependencies,
          replicas
        );
        const endpointMap = new Map<string, TCombinedRealtimeData[]>();
        const serviceMap = new Map<string, TCombinedRealtimeData[]>();
        dailyData.forEach((r) => {
          endpointMap.set(
            r.uniqueEndpointName,
            (endpointMap.get(r.uniqueEndpointName) || []).concat([r])
          );
          serviceMap.set(
            r.uniqueServiceName,
            (serviceMap.get(r.uniqueServiceName) || []).concat([r])
          );
        });
        const allEndpoints = this.createHistoricalEndpointInfo(
          endpointMap,
          labelMap
        );
        return {
          date: new Date(time),
          services: this.createHistoricalServiceInfo(
            time,
            serviceMap,
            allEndpoints,
            risks
          ),
        };
      }
    );
  }
  private createHistoricalEndpointInfo(
    endpointMap: Map<string, TCombinedRealtimeData[]>,
    labelMap?: Map<string, string>
  ) {
    return [...endpointMap.entries()].map(
      ([uniqueEndpointName, r]): THistoricalEndpointInfo => {
        const [service, namespace, version, method] =
          uniqueEndpointName.split("\t");
        const { requests, requestErrors, serverErrors } = r.reduce(
          (prev, curr) => {
            const add = curr.combined;
            prev.requests += add;
            if (curr.status.startsWith("4")) prev.requestErrors += add;
            if (curr.status.startsWith("5")) prev.serverErrors += add;
            return prev;
          },
          { requests: 0, requestErrors: 0, serverErrors: 0 }
        );

        return {
          latencyCV: Math.max(...r.map((rl) => rl.latency.cv)),
          method: method as TRequestTypeUpper,
          requestErrors,
          requests,
          serverErrors,
          uniqueEndpointName,
          uniqueServiceName: `${service}\t${namespace}\t${version}`,
          labelName: labelMap?.get(uniqueEndpointName),
        };
      }
    );
  }
  private createHistoricalServiceInfo(
    time: number,
    serviceMap: Map<string, TCombinedRealtimeData[]>,
    allEndpoints: THistoricalEndpointInfo[],
    risks: TRiskResult[]
  ) {
    return [...serviceMap.entries()].map(
      ([uniqueServiceName, r]): THistoricalServiceInfo => {
        const [service, namespace, version] = uniqueServiceName.split("\t");
        const endpoints = allEndpoints.filter(
          (e) => e.uniqueServiceName === uniqueServiceName
        );
        const { requests, requestErrors, serverErrors } = endpoints.reduce(
          (prev, curr) => {
            prev.requestErrors += curr.requestErrors;
            prev.serverErrors += curr.serverErrors;
            prev.requests += curr.requests;
            return prev;
          },
          { requests: 0, requestErrors: 0, serverErrors: 0 }
        );

        return {
          date: new Date(time),
          endpoints,
          service,
          namespace,
          version,
          requests,
          requestErrors,
          serverErrors,
          latencyCV: Math.max(...r.map((rl) => rl.latency.cv)),
          uniqueServiceName,
          risk: risks.find(
            (rsk) => rsk.uniqueServiceName === uniqueServiceName
          )!.norm,
        };
      }
    );
  }

  toAggregatedData(
    serviceDependencies: TServiceDependency[],
    replicas: TReplicaCount[] = [],
    labelMap?: Map<string, string>
  ): TAggregatedData {
    const historicalData = this.toHistoricalData(
      serviceDependencies,
      replicas,
      labelMap
    );
    let minDate = Number.MAX_SAFE_INTEGER;
    let maxDate = Number.MIN_SAFE_INTEGER;

    const serviceMap = new Map<string, THistoricalServiceInfo[]>();
    historicalData
      .flatMap((h) => h.services)
      .forEach((s) => {
        const time = s.date.getTime();
        if (time > maxDate) maxDate = time;
        if (time < minDate) minDate = time;

        serviceMap.set(
          s.uniqueServiceName,
          (serviceMap.get(s.uniqueServiceName) || []).concat([{ ...s }])
        );
      });

    const aggregatedData = {
      fromDate: new Date(minDate),
      toDate: new Date(maxDate),
      services: this.createAggregatedServiceInfo(serviceMap, labelMap),
    };
    return aggregatedData;
  }
  private createAggregatedServiceInfo(
    serviceMap: Map<string, THistoricalServiceInfo[]>,
    labelMap?: Map<string, string>
  ) {
    return [...serviceMap.entries()].map(
      ([uniqueServiceName, serviceGroup]) => {
        const [service, namespace, version] = uniqueServiceName.split("\t");
        const endpointMap = new Map<string, THistoricalEndpointInfo[]>();
        serviceGroup
          .flatMap((s) => s.endpoints)
          .forEach((e) => {
            endpointMap.set(
              e.uniqueEndpointName,
              (endpointMap.get(e.uniqueEndpointName) || []).concat([e])
            );
          });
        const endpoints = this.createAggregatedEndpointInfo(
          uniqueServiceName,
          endpointMap,
          labelMap
        );

        let avgRisk = 0;
        let avgLatencyCV = 0;
        const sumResult = serviceGroup.reduce(
          (prev, curr) => {
            prev.totalRequests += curr.requests;
            prev.totalServerErrors += curr.serverErrors;
            prev.totalRequestErrors += curr.requestErrors;
            avgRisk += curr.risk || 0;
            avgLatencyCV += curr.latencyCV;
            return prev;
          },
          { totalRequests: 0, totalServerErrors: 0, totalRequestErrors: 0 }
        );
        avgRisk /= serviceGroup.length;
        avgLatencyCV /= serviceGroup.length;

        return {
          uniqueServiceName,
          service,
          namespace,
          version,
          ...sumResult,
          avgRisk,
          avgLatencyCV,
          endpoints,
        };
      }
    );
  }
  private createAggregatedEndpointInfo(
    uniqueServiceName: string,
    endpointMap: Map<string, THistoricalEndpointInfo[]>,
    labelMap?: Map<string, string>
  ) {
    return [...endpointMap.entries()].map(
      ([uniqueEndpointName, endpointGroup]): TAggregatedEndpointInfo => {
        const [, , , method] = uniqueEndpointName.split("\t");

        let latencySum = 0;
        const sumResult = endpointGroup.reduce(
          (prev, curr) => {
            prev.totalRequests += curr.requests;
            prev.totalServerErrors += curr.serverErrors;
            prev.totalRequestErrors += curr.requestErrors;
            latencySum += curr.latencyCV;
            return prev;
          },
          {
            totalRequests: 0,
            totalServerErrors: 0,
            totalRequestErrors: 0,
          }
        );

        return {
          uniqueServiceName,
          uniqueEndpointName,
          labelName: labelMap?.get(uniqueEndpointName),
          method: method as TRequestTypeUpper,
          ...sumResult,
          avgLatencyCV: latencySum / endpointGroup.length,
        };
      }
    );
  }

  extractEndpointDataType(labelMap?: Map<string, string>) {
    return this._combinedRealtimeData
      .map((r): TEndpointDataType => {
        const tokens = r.uniqueEndpointName.split("\t");
        const requestParams = Utils.GetParamsFromUrl(tokens[tokens.length - 1]);
        return {
          service: r.service,
          namespace: r.namespace,
          method: r.method,
          version: r.version,
          uniqueEndpointName: r.uniqueEndpointName,
          uniqueServiceName: r.uniqueServiceName,
          labelName: labelMap?.get(r.uniqueEndpointName),
          schemas: [
            {
              status: r.status,
              time: new Date(r.latestTimestamp / 1000),
              requestContentType: r.requestContentType,
              requestSample: r.requestBody,
              requestSchema: r.requestSchema,
              responseContentType: r.responseContentType,
              responseSample: r.responseBody,
              responseSchema: r.responseSchema,
              requestParams,
            },
          ],
        };
      })
      .map((e) => new EndpointDataType(e));
  }

  combineWith(rlData: CombinedRealtimeDataList) {
    const uniqueNameMap = new Map<string, TCombinedRealtimeData[]>();
    this._combinedRealtimeData
      .concat(rlData._combinedRealtimeData)
      .forEach((r) => {
        const id = `${r.uniqueEndpointName}\t${r.status}`;
        uniqueNameMap.set(id, (uniqueNameMap.get(id) || []).concat([r]));
      });

    const combined = [...uniqueNameMap.values()].map(
      (group): TCombinedRealtimeData => {
        const sample = group[0];
        const baseSample = {
          uniqueEndpointName: sample.uniqueEndpointName,
          uniqueServiceName: sample.uniqueServiceName,
          service: sample.service,
          namespace: sample.namespace,
          version: sample.version,
          method: sample.method,
          status: sample.status,
          combined: group.reduce((prev, curr) => prev + curr.combined, 0),
          requestContentType: sample.requestContentType,
          responseContentType: sample.responseContentType,
        };

        const combined = group.reduce((prev, curr) => {
          if (prev.avgReplica && curr.avgReplica)
            prev.avgReplica += curr.avgReplica;
          prev.latestTimestamp = Math.max(
            prev.latestTimestamp,
            curr.latestTimestamp
          );

          prev.requestBody = Utils.Merge(prev.requestBody, curr.requestBody);
          prev.responseBody = Utils.Merge(prev.responseBody, curr.responseBody);

          if (prev.requestBody) {
            prev.requestSchema = Utils.ObjectToInterfaceString(
              prev.requestBody
            );
          }
          if (prev.responseBody) {
            prev.responseSchema = Utils.ObjectToInterfaceString(
              prev.responseBody
            );
          }
          return prev;
        });

        let { latencyMean, latencyDivBase } = group.reduce(
          (prev, curr) => {
            prev.latencyMean += curr.latency.mean * curr.combined;
            prev.latencyDivBase += curr.latency.divBase;
            return prev;
          },
          { latencyMean: 0, latencyDivBase: 0 }
        );
        latencyMean /= baseSample.combined;

        return {
          ...baseSample,
          latestTimestamp: combined.latestTimestamp,
          requestBody: combined.requestBody,
          requestSchema: combined.requestSchema,
          responseBody: combined.responseBody,
          responseSchema: combined.responseSchema,
          latency: {
            mean: latencyMean,
            divBase: latencyDivBase,
            cv:
              Math.sqrt(
                latencyDivBase / baseSample.combined - Math.pow(latencyMean, 2)
              ) / latencyMean,
          },
        };
      }
    );

    return new CombinedRealtimeDataList(combined);
  }

  getContainingNamespaces() {
    return new Set(this._combinedRealtimeData.map((r) => r.namespace));
  }
}

import { IAggregateEndpointInfo } from "../entities/IAggregateData";
import { ICombinedRealtimeData } from "../entities/ICombinedRealtimeData";
import IEndpointDataType from "../entities/IEndpointDataType";
import IHistoryData, {
  IHistoryEndpointInfo,
  IHistoryServiceInfo,
} from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import { IRequestTypeUpper } from "../entities/IRequestType";
import IRiskResult from "../entities/IRiskResult";
import IServiceDependency from "../entities/IServiceDependency";
import RiskAnalyzer from "../utils/RiskAnalyzer";
import Utils from "../utils/Utils";
import EndpointDataType from "./EndpointDataType";

export default class CombinedRealtimeData {
  private readonly _combinedRealtimeData: ICombinedRealtimeData[];
  constructor(combinedRealtimeData: ICombinedRealtimeData[]) {
    this._combinedRealtimeData = combinedRealtimeData;
  }
  get combinedRealtimeData() {
    return this._combinedRealtimeData;
  }

  toHistoryData(
    serviceDependencies: IServiceDependency[],
    replicas: IReplicaCount[] = [],
    labelMap?: Map<string, string>
  ) {
    const dateMapping = new Map<number, ICombinedRealtimeData[]>();
    this._combinedRealtimeData.forEach((r) => {
      const time = Utils.BelongsToDateTimestamp(r.latestTimestamp / 1000);
      dateMapping.set(time, (dateMapping.get(time) || []).concat([r]));
    });

    return [...dateMapping.entries()].map(([time, dailyData]): IHistoryData => {
      const risks = RiskAnalyzer.RealtimeRisk(
        new CombinedRealtimeData(dailyData).toRealtimeDataForm(),
        serviceDependencies,
        replicas
      );
      const endpointMap = new Map<string, ICombinedRealtimeData[]>();
      const serviceMap = new Map<string, ICombinedRealtimeData[]>();
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
      const allEndpoints = this.createHistoryEndpointInfo(
        endpointMap,
        labelMap
      );
      return {
        date: new Date(time),
        services: this.createHistoryServiceInfo(
          time,
          serviceMap,
          allEndpoints,
          risks
        ),
      };
    });
  }
  private createHistoryEndpointInfo(
    endpointMap: Map<string, ICombinedRealtimeData[]>,
    labelMap?: Map<string, string>
  ) {
    return [...endpointMap.entries()].map(
      ([uniqueEndpointName, r]): IHistoryEndpointInfo => {
        const [service, namespace, version, method] =
          uniqueEndpointName.split("\t");
        let requestErrors = 0;
        let serverErrors = 0;
        const requests = r.reduce((prev, curr) => {
          if (curr.status.startsWith("4")) requestErrors++;
          if (curr.status.startsWith("5")) serverErrors++;
          return prev + curr.combined;
        }, 0);

        return {
          latencyCV: RiskAnalyzer.CoefficientOfVariation(
            r.flatMap((rl) => rl.latencies)
          ),
          method: method as IRequestTypeUpper,
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
  private createHistoryServiceInfo(
    time: number,
    serviceMap: Map<string, ICombinedRealtimeData[]>,
    allEndpoints: IHistoryEndpointInfo[],
    risks: IRiskResult[]
  ) {
    return [...serviceMap.entries()].map(
      ([uniqueServiceName, r]): IHistoryServiceInfo => {
        const [service, namespace, version] = uniqueServiceName.split("\t");
        const endpoints = allEndpoints.filter(
          (e) => e.uniqueServiceName === uniqueServiceName
        );
        let requestErrors = 0;
        let serverErrors = 0;
        const requests = endpoints.reduce((prev, curr) => {
          requestErrors += curr.requestErrors;
          serverErrors += curr.serverErrors;
          return prev + curr.requests;
        }, 0);

        return {
          date: new Date(time),
          endpoints,
          service,
          namespace,
          version,
          requests,
          requestErrors,
          serverErrors,
          latencyCV: RiskAnalyzer.CoefficientOfVariation(
            r.flatMap((r) => r.latencies)
          ),
          uniqueServiceName,
          risk: risks.find(
            (rsk) => rsk.uniqueServiceName === uniqueServiceName
          )!.risk,
        };
      }
    );
  }

  toAggregatedDataAndHistoryData(
    serviceDependencies: IServiceDependency[],
    replicas: IReplicaCount[] = [],
    labelMap?: Map<string, string>
  ) {
    const historyData = this.toHistoryData(
      serviceDependencies,
      replicas,
      labelMap
    );
    let minDate = Number.MAX_SAFE_INTEGER;
    let maxDate = Number.MIN_SAFE_INTEGER;

    const serviceMap = new Map<string, IHistoryServiceInfo[]>();
    historyData
      .flatMap((h) => h.services)
      .forEach((s) => {
        const time = s.date.getTime();
        if (time > maxDate) maxDate = time;
        if (time < minDate) minDate = time;

        serviceMap.set(
          s.uniqueServiceName,
          (serviceMap.get(s.uniqueServiceName) || []).concat([s])
        );
      });

    const aggregateData = {
      fromDate: new Date(minDate),
      toDate: new Date(maxDate),
      services: this.createAggregateServiceInfo(serviceMap, labelMap),
    };
    return { aggregateData, historyData };
  }
  private createAggregateServiceInfo(
    serviceMap: Map<string, IHistoryServiceInfo[]>,
    labelMap?: Map<string, string>
  ) {
    return [...serviceMap.entries()].map(
      ([uniqueServiceName, serviceGroup]) => {
        const [service, namespace, version] = uniqueServiceName.split("\t");
        const endpointMap = new Map<string, IHistoryEndpointInfo[]>();
        serviceGroup
          .flatMap((s) => s.endpoints)
          .forEach((e) => {
            endpointMap.set(
              e.uniqueEndpointName,
              (endpointMap.get(e.uniqueEndpointName) || []).concat([e])
            );
          });
        const endpoints = this.createAggregateEndpointInfo(
          uniqueServiceName,
          endpointMap,
          labelMap
        );

        let totalRequests = 0;
        let totalServerErrors = 0;
        let totalRequestErrors = 0;
        let avgRisk = 0;
        let avgLatencyCV = 0;
        serviceGroup.forEach((s) => {
          totalRequests += s.requests;
          totalServerErrors += s.serverErrors;
          totalRequestErrors += s.requestErrors;
          avgRisk += s.risk || 0;
          avgLatencyCV += s.latencyCV;
        });
        avgRisk /= serviceGroup.length;
        avgLatencyCV /= serviceGroup.length;

        return {
          uniqueServiceName,
          service,
          namespace,
          version,
          totalRequests,
          totalServerErrors,
          totalRequestErrors,
          avgRisk,
          avgLatencyCV,
          endpoints,
        };
      }
    );
  }
  private createAggregateEndpointInfo(
    uniqueServiceName: string,
    endpointMap: Map<string, IHistoryEndpointInfo[]>,
    labelMap?: Map<string, string>
  ) {
    return [...endpointMap.entries()].map(
      ([uniqueEndpointName, endpointGroup]): IAggregateEndpointInfo => {
        const [, , , method] = uniqueEndpointName.split("\t");
        let totalRequests = 0;
        let totalServerErrors = 0;
        let totalRequestErrors = 0;
        let avgLatencyCV = 0;
        endpointGroup.forEach((e) => {
          totalRequests += e.requests;
          totalServerErrors += e.serverErrors;
          totalRequestErrors += e.requestErrors;
          avgLatencyCV += e.latencyCV;
        });
        avgLatencyCV /= endpointGroup.length;

        return {
          uniqueServiceName,
          uniqueEndpointName,
          labelName: labelMap?.get(uniqueEndpointName),
          method: method as IRequestTypeUpper,
          totalRequests,
          totalServerErrors,
          totalRequestErrors,
          avgLatencyCV,
        };
      }
    );
  }

  extractEndpointDataType(labelMap?: Map<string, string>) {
    return this._combinedRealtimeData
      .map((r): IEndpointDataType => {
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

  toRealtimeDataForm() {
    return this._combinedRealtimeData.map((r): IRealtimeData => {
      return {
        uniqueServiceName: r.uniqueServiceName,
        uniqueEndpointName: r.uniqueEndpointName,
        service: r.service,
        namespace: r.namespace,
        version: r.version,
        latency: r.avgLatency,
        method: r.method,
        status: r.status,
        timestamp: r.latestTimestamp,
        replica: r.avgReplica,
        requestBody: r.requestBody,
        requestContentType: r.requestContentType,
        responseBody: r.responseBody,
        responseContentType: r.responseContentType,
      };
    });
  }

  combineWith(rlData: CombinedRealtimeData) {
    const uniqueNameMap = new Map<string, ICombinedRealtimeData[]>();
    this._combinedRealtimeData
      .concat(rlData._combinedRealtimeData)
      .forEach((r) => {
        const id = `${r.uniqueEndpointName}\t${r.status}`;
        uniqueNameMap.set(id, (uniqueNameMap.get(id) || []).concat([r]));
      });

    const combined = [...uniqueNameMap.values()].map(
      (group): ICombinedRealtimeData => {
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
          prev.avgLatency += curr.avgLatency;
          prev.latestTimestamp =
            prev.latestTimestamp > curr.latestTimestamp
              ? prev.latestTimestamp
              : curr.latestTimestamp;

          prev.requestBody = Utils.Merge(prev.requestBody, curr.requestBody);
          prev.responseBody = Utils.Merge(prev.responseBody, curr.responseBody);
          prev.requestSchema = prev.requestBody
            ? Utils.ObjectToInterfaceString(prev.requestBody)
            : prev.requestSchema;
          prev.responseSchema = prev.responseBody
            ? Utils.ObjectToInterfaceString(prev.responseBody)
            : prev.responseSchema;
          return prev;
        });

        return {
          ...baseSample,
          avgLatency: combined.avgLatency / group.length,
          latestTimestamp: combined.latestTimestamp,
          requestBody: combined.requestBody,
          requestSchema: combined.requestSchema,
          responseBody: combined.responseBody,
          responseSchema: combined.responseSchema,
          latencies: group.flatMap((r) => r.latencies),
        };
      }
    );

    return new CombinedRealtimeData(combined);
  }

  getContainingNamespaces() {
    return new Set(this._combinedRealtimeData.map((r) => r.namespace));
  }
}

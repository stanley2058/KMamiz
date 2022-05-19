import {
  TAggregatedData,
  TAggregatedEndpointInfo,
} from "../entities/TAggregatedData";
import { TCombinedRealtimeData } from "../entities/TCombinedRealtimeData";
import {
  THistoricalData,
  THistoricalEndpointInfo,
  THistoricalServiceInfo,
} from "../entities/THistoricalData";
import { TRequestTypeUpper } from "../entities/TRequestType";
import { TRiskResult } from "../entities/TRiskResult";
import CombinedRealtimeDataList from "./CombinedRealtimeDataList";

export class HistoricalData {
  private readonly _historicalData: THistoricalData;
  constructor(historicalData: THistoricalData) {
    this._historicalData = historicalData;
  }

  toJSON() {
    return this._historicalData;
  }

  toCombinedRealtimeDataList() {
    const mapped = this._historicalData.services.flatMap(
      (s): TCombinedRealtimeData[] => {
        const [service, namespace, version] = s.uniqueServiceName.split("\t");

        return s.endpoints.flatMap((e) => {
          const base = {
            service,
            namespace,
            version,
            method: e.method,
            latestTimestamp: s.date.getTime() * 1000,
            uniqueServiceName: e.uniqueServiceName,
            uniqueEndpointName: e.uniqueEndpointName,
          };

          const normal = e.requests - e.requestErrors - e.serverErrors;
          const result = [];

          if (normal) {
            result.push({
              ...base,
              combined: normal,
              latency: {
                mean: 1,
                divBase: Math.pow(e.latencyCV, 2) * normal,
                cv: e.latencyCV,
              },
              status: "200",
            });
          }

          if (e.requestErrors) {
            result.push({
              ...base,
              combined: e.requestErrors,
              latency: {
                mean: 1,
                divBase: Math.pow(e.latencyCV, 2) * e.requestErrors,
                cv: e.latencyCV,
              },
              status: "400",
            });
          }

          if (e.serverErrors) {
            result.push({
              ...base,
              combined: e.serverErrors,
              latency: {
                mean: 1,
                divBase: Math.pow(e.latencyCV, 2) * e.serverErrors,
                cv: e.latencyCV,
              },
              status: "500",
            });
          }
          return result;
        });
      }
    );
    return new CombinedRealtimeDataList(mapped);
  }

  updateRiskValue(riskResult: TRiskResult[]) {
    const riskMap = new Map<string, TRiskResult>();
    riskResult.forEach((r) => {
      riskMap.set(r.uniqueServiceName, r);
    });

    this._historicalData.services.forEach((s) => {
      if (riskMap.has(s.uniqueServiceName)) {
        s.risk = riskMap.get(s.uniqueServiceName)!.norm;
      }
    });
    return this;
  }

  toAggregatedData(labelMap?: Map<string, string>): TAggregatedData {
    let minDate = Number.MAX_SAFE_INTEGER;
    let maxDate = Number.MIN_SAFE_INTEGER;

    const serviceMap = new Map<string, THistoricalServiceInfo[]>();
    this._historicalData.services.forEach((s) => {
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
}

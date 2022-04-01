import {
  TAggregatedData,
  TAggregatedEndpointInfo,
  TAggregatedServiceInfo,
} from "../entities/TAggregatedData";
import Logger from "../utils/Logger";

export class AggregatedData {
  private readonly _aggregatedData: TAggregatedData;
  constructor(aggregatedData: TAggregatedData) {
    this._aggregatedData = aggregatedData;
  }

  toJSON() {
    return this._aggregatedData;
  }

  combine({ fromDate: fDate, toDate: tDate, services }: TAggregatedData) {
    const fromDate = this.decideFromDate(fDate);
    const toDate = this.decideToDate(tDate);

    const serviceMap = new Map<string, TAggregatedServiceInfo>();
    [...this._aggregatedData.services, ...services].forEach((s) => {
      if (!serviceMap.has(s.uniqueServiceName))
        serviceMap.set(s.uniqueServiceName, s);
      else {
        serviceMap.set(
          s.uniqueServiceName,
          this.mergeAggregateServiceInfo(
            serviceMap.get(s.uniqueServiceName)!,
            s
          )
        );
      }
    });
    return new AggregatedData({
      fromDate,
      toDate,
      services: [...serviceMap.values()],
    });
  }

  mergeAggregateServiceInfo(
    a: TAggregatedServiceInfo,
    b: TAggregatedServiceInfo
  ) {
    if (a.uniqueServiceName !== b.uniqueServiceName) {
      Logger.error("Trying to merge mismatched service info, skipping.");
      Logger.verbose("Trace:", new Error().stack);
      return a;
    }
    const totalRequests = a.totalRequests + b.totalRequests;
    a.totalRequestErrors += b.totalRequestErrors;
    a.totalServerErrors += b.totalServerErrors;
    a.avgRisk =
      (a.totalRequests / totalRequests) * a.avgRisk +
      (b.totalRequests / totalRequests) * b.avgRisk;
    a.endpoints = this.mergeAggregateEndpointInfo(a.endpoints, b.endpoints);
    return { ...a, totalRequests };
  }
  mergeAggregateEndpointInfo(
    a: TAggregatedEndpointInfo[],
    b: TAggregatedEndpointInfo[]
  ) {
    const endpointMap = new Map<string, TAggregatedEndpointInfo>();
    [...a, ...b].forEach((e) => {
      if (!endpointMap.has(e.uniqueEndpointName)) {
        endpointMap.set(e.uniqueEndpointName, e);
      } else {
        const prev = endpointMap.get(e.uniqueEndpointName)!;
        prev.totalRequests += e.totalRequests;
        prev.totalRequestErrors += e.totalRequestErrors;
        prev.totalServerErrors += e.totalServerErrors;
        endpointMap.set(e.uniqueEndpointName, prev);
      }
    });
    return [...endpointMap.values()];
  }

  private decideFromDate(date: Date) {
    const { fromDate } = this._aggregatedData;
    return fromDate > date ? date : fromDate;
  }
  private decideToDate(date: Date) {
    const { toDate } = this._aggregatedData;
    return toDate < date ? date : toDate;
  }
}

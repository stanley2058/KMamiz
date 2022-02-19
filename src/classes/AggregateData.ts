import IAggregateData, {
  IAggregateEndpointInfo,
  IAggregateServiceInfo,
} from "../entities/IAggregateData";
import Logger from "../utils/Logger";

export class AggregateData {
  private readonly _aggregateData: IAggregateData;
  constructor(aggregateData: IAggregateData) {
    this._aggregateData = aggregateData;
  }
  get aggregateData() {
    return this._aggregateData;
  }

  combine({ fromDate: fDate, toDate: tDate, services }: IAggregateData) {
    const fromDate = this.decideFromDate(fDate);
    const toDate = this.decideToDate(tDate);

    const serviceMap = new Map<string, IAggregateServiceInfo>();
    [...this._aggregateData.services, ...services].forEach((s) => {
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
    return new AggregateData({
      fromDate,
      toDate,
      services: [...serviceMap.values()],
    });
  }

  mergeAggregateServiceInfo(
    a: IAggregateServiceInfo,
    b: IAggregateServiceInfo
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
    a: IAggregateEndpointInfo[],
    b: IAggregateEndpointInfo[]
  ) {
    const endpointMap = new Map<string, IAggregateEndpointInfo>();
    [...a, ...b].forEach((e) => {
      if (!endpointMap.has(e.labelName)) endpointMap.set(e.labelName, e);
      else {
        const prev = endpointMap.get(e.labelName)!;
        prev.totalRequests += e.totalRequests;
        prev.totalRequestErrors += e.totalRequestErrors;
        prev.totalServerErrors += e.totalServerErrors;
        endpointMap.set(e.labelName, prev);
      }
    });
    return [...endpointMap.values()];
  }

  private decideFromDate(date: Date) {
    const { fromDate } = this._aggregateData;
    return fromDate > date ? date : fromDate;
  }
  private decideToDate(date: Date) {
    const { toDate } = this._aggregateData;
    return toDate < date ? date : toDate;
  }
}

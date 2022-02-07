import RiskAnalyzer from "../utils/RiskAnalyzer";
import Utils from "../utils/Utils";
import IHistoryData from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import IServiceDependency from "../entities/IServiceDependency";
import IEndpointDataType from "../entities/IEndpointDataType";
import EndpointDataType from "./EndpointDataType";
import IAggregateData from "../entities/IAggregateData";

export class RealtimeData {
  private readonly _realtimeData: IRealtimeData[];
  constructor(realtimeData: IRealtimeData[]) {
    this._realtimeData = realtimeData;
  }
  get realtimeData() {
    return this._realtimeData;
  }

  toHistoryData(
    serviceDependencies: IServiceDependency[],
    replicas: IReplicaCount[] = []
  ) {
    const uniqueDates = [
      ...new Set(
        this._realtimeData.map((r) =>
          Utils.BelongsToDateTimestamp(r.timestamp / 1000)
        )
      ),
    ];

    return uniqueDates.map((d) => {
      const serviceMapping: {
        [id: string]: {
          service: string;
          namespace: string;
          version: string;
          requests: number;
          serverErrors: number;
          requestErrors: number;
          risk?: number;
        };
      } = {};
      const dataOfADay = this._realtimeData.filter(
        (r) => Utils.BelongsToDateTimestamp(r.timestamp / 1000) === d
      );
      const risks = RiskAnalyzer.RealtimeRisk(
        dataOfADay,
        serviceDependencies,
        replicas
      );

      return {
        date: new Date(d),
        services: Object.values(
          dataOfADay.reduce((prev, curr) => {
            const uniqueName = `${curr.service}\t${curr.namespace}\t${curr.version}`;
            if (!prev[uniqueName]) {
              prev[uniqueName] = {
                service: curr.service,
                namespace: curr.namespace,
                version: curr.version,
                requests: 0,
                serverErrors: 0,
                requestErrors: 0,
                risk: risks.find(
                  (r) =>
                    `${r.service}\t${r.namespace}\t${r.version}` === uniqueName
                )?.norm,
              };
            }
            prev[uniqueName].requests++;
            if (curr.status.startsWith("5")) prev[uniqueName].serverErrors++;
            if (curr.status.startsWith("4")) prev[uniqueName].requestErrors++;

            return prev;
          }, serviceMapping)
        ),
      };
    }) as IHistoryData[];
  }

  extractEndpointDataType() {
    return this._realtimeData
      .filter((r) => !!r.body)
      .map(
        ({ service, version, namespace, endpointName, timestamp, body }) =>
          new EndpointDataType({
            service,
            version,
            namespace,
            endpoint: endpointName,
            schemas: [
              {
                time: new Date(timestamp),
                sampleObject: JSON.parse(body!),
                schema: Utils.ObjectToInterfaceString(JSON.parse(body!)),
              },
            ],
          } as IEndpointDataType)
      );
  }

  getAvgReplicaCount() {
    const addUpMap = new Map<string, number>();
    const appearsMap = new Map<string, number>();

    this._realtimeData.forEach((r) => {
      const uniqueName = `${r.service}\t${r.namespace}\t${r.version}`;
      if (r.replica) {
        if (!addUpMap.has(uniqueName)) {
          addUpMap.set(uniqueName, 0);
          appearsMap.set(uniqueName, 0);
        }
        addUpMap.set(uniqueName, addUpMap.get(uniqueName)! + r.replica);
        appearsMap.set(uniqueName, appearsMap.get(uniqueName)! + 1);
      }
    });
    return this._realtimeData
      .map((r) => {
        const uniqueName = `${r.service}\t${r.namespace}\t${r.version}`;
        if (!addUpMap.get(uniqueName) || !appearsMap.get(uniqueName)) return;
        const replicas =
          addUpMap.get(uniqueName)! / appearsMap.get(uniqueName)!;

        return {
          service: r.service,
          namespace: r.namespace,
          version: r.version,
          replicas,
        } as IReplicaCount;
      })
      .filter((r) => !!r) as IReplicaCount[];
  }

  toAggregatedDataAndHistoryData(
    serviceDependencies: IServiceDependency[],
    replicas: IReplicaCount[] = []
  ) {
    const avgReplicas = this.getAvgReplicaCount();
    const combinedReplicas = [
      ...avgReplicas,
      ...replicas.filter(
        (r) =>
          !avgReplicas.find(
            (aR) =>
              aR.service === r.service &&
              aR.namespace === r.namespace &&
              aR.version === r.version
          )
      ),
    ];

    const historyData = this.toHistoryData(
      serviceDependencies,
      combinedReplicas
    );
    const dates = historyData.map((d) => d.date.getTime()).sort();
    const fromDate = new Date(dates[0]);
    const toDate = new Date(dates[dates.length - 1]);

    const aggregateData = {
      fromDate,
      toDate,
      services: Object.values(
        historyData.reduce(
          (prev, curr) => {
            curr.services.forEach((s) => {
              const uniqueName = `${s.service}\t${s.namespace}\t${s.version}`;
              if (!prev[uniqueName]) {
                prev[uniqueName] = {
                  name: s.service,
                  namespace: s.namespace,
                  version: s.version,
                  totalRequests: 0,
                  totalRequestErrors: 0,
                  totalServerErrors: 0,
                  avgRisk: 0,
                };
              }
              if (s.risk) {
                prev[uniqueName].avgRisk =
                  (prev[uniqueName].avgRisk * prev[uniqueName].totalRequests +
                    s.risk * s.requests) /
                  (prev[uniqueName].totalRequests + s.requests);
              }
              prev[uniqueName].totalRequests += s.requests;
              prev[uniqueName].totalRequestErrors += s.requestErrors;
              prev[uniqueName].totalServerErrors += s.serverErrors;
            });
            return prev;
          },
          {} as {
            [id: string]: {
              name: string;
              namespace: string;
              version: string;
              totalRequests: number;
              totalServerErrors: number;
              totalRequestErrors: number;
              avgRisk: number;
            };
          }
        )
      ),
    } as IAggregateData;
    return { historyData, aggregateData };
  }
}

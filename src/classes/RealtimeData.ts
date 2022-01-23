import RiskAnalyzer from "../utils/RiskAnalyzer";
import Utils from "../utils/Utils";
import IHistoryData from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import IServiceDependency from "../entities/IServiceDependency";

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
}

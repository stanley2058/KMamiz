import RiskAnalyzer from "../utils/RiskAnalyzer";
import Utils from "../utils/Utils";
import IHistoryData, {
  IHistoryEndpointInfo,
  IHistoryServiceInfo,
} from "../entities/IHistoryData";
import { IRealtimeData } from "../entities/IRealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import IServiceDependency from "../entities/IServiceDependency";
import IEndpointDataType from "../entities/IEndpointDataType";
import EndpointDataType from "./EndpointDataType";
import IAggregateData, {
  IAggregateEndpointInfo,
  IAggregateServiceInfo,
} from "../entities/IAggregateData";
import IRiskResult from "../entities/IRiskResult";

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
      const date = new Date(d);
      const dataOfADay = this._realtimeData.filter(
        (r) => Utils.BelongsToDateTimestamp(r.timestamp / 1000) === d
      );
      const risks = RiskAnalyzer.RealtimeRisk(
        dataOfADay,
        serviceDependencies,
        replicas
      );
      const endpointInfoMap = this.createEndpointInfoMapping(dataOfADay);
      const services = this.createServiceHistoryData(
        date,
        risks,
        endpointInfoMap
      );

      return { date, services };
    }) as IHistoryData[];
  }
  private createEndpointInfoMapping(realtimeData: IRealtimeData[]) {
    const endpointInfoMap = new Map<
      string,
      Map<string, IHistoryEndpointInfo & { latencies: number[] }>
    >();
    realtimeData.forEach((r) => {
      const serviceName = `${r.service}\t${r.namespace}\t${r.version}`;
      const endpointName = `${r.protocol}\t${r.endpointName}`;
      if (!endpointInfoMap.has(serviceName)) {
        endpointInfoMap.set(
          serviceName,
          new Map<string, IHistoryEndpointInfo & { latencies: number[] }>()
        );
      }
      if (!endpointInfoMap.get(serviceName)!.has(endpointName)) {
        endpointInfoMap.get(serviceName)!.set(endpointName, {
          name: r.endpointName,
          protocol: r.protocol,
          requests: 0,
          requestErrors: 0,
          serverErrors: 0,
          latencyCV: 0,
          latencies: [],
        });
      }

      const info = endpointInfoMap.get(serviceName)!.get(endpointName)!;
      info.requests++;
      info.latencies.push(r.latency);
      if (r.status.startsWith("5")) info.serverErrors++;
      if (r.status.startsWith("4")) info.requestErrors++;
      endpointInfoMap.get(serviceName)!.set(endpointName, info);
    });
    [...endpointInfoMap.keys()].forEach((s) => {
      endpointInfoMap.get(s)!.forEach((val) => {
        val.latencyCV = RiskAnalyzer.CoefficientOfVariation(val.latencies);
      });
    });
    return endpointInfoMap;
  }
  private createServiceHistoryData(
    date: Date,
    risks: IRiskResult[],
    endpointInfoMap: Map<string, Map<string, IHistoryEndpointInfo>>
  ): IHistoryServiceInfo[] {
    return [...endpointInfoMap.entries()].map(([serviceName, endpointMap]) => {
      const [service, namespace, version] = serviceName.split("\t");
      const status = [...endpointMap.values()].reduce(
        (prev, curr) => ({
          requests: prev.requests + curr.requests,
          serverErrors: prev.serverErrors + curr.serverErrors,
          requestErrors: prev.requestErrors + curr.requestErrors,
          latencyCV: Math.max(prev.latencyCV, curr.latencyCV),
        }),
        { requests: 0, serverErrors: 0, requestErrors: 0, latencyCV: 0 }
      );

      const serviceInfo: IHistoryServiceInfo = {
        date,
        service,
        namespace,
        version,
        ...status,
        risk: risks.find(
          (r) => `${r.service}\t${r.namespace}\t${r.version}` === serviceName
        )?.norm,
        endpoints: [...endpointMap.values()],
      };
      return serviceInfo;
    });
  }

  extractEndpointDataType() {
    const endpointDataTypeMap = this._realtimeData
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
                time: new Date(timestamp / 1000),
                sampleObject: JSON.parse(body!),
                schema: Utils.ObjectToInterfaceString(JSON.parse(body!)),
              },
            ],
          } as IEndpointDataType)
      )
      .reduce((prev, curr) => {
        curr = curr.removeDuplicateSchemas();
        const id = `${curr.endpointDataType.version}\t${curr.endpointDataType.endpoint}`;
        if (!prev.has(id)) prev.set(id, curr);
        else {
          const existSchemas = prev.get(id)!.endpointDataType.schemas;
          const currentSchemas = curr.endpointDataType.schemas;
          if (
            existSchemas[existSchemas.length - 1] !==
            currentSchemas[currentSchemas.length - 1]
          ) {
            prev.set(
              id,
              prev.get(id)!.mergeSchemaWith(curr).removeDuplicateSchemas()
            );
          }
        }
        return prev;
      }, new Map<string, EndpointDataType>());
    return [...endpointDataTypeMap.entries()].map(
      ([, endpointDataType]) => endpointDataType
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

    const historyServiceInfoMap = new Map<string, IHistoryServiceInfo[]>();
    historyData
      .map((h) => h.services)
      .flat()
      .reduce((map, service) => {
        const uniqueName = `${service.service}\t${service.namespace}\t${service.version}`;
        return map.set(uniqueName, [...(map.get(uniqueName) || []), service]);
      }, historyServiceInfoMap);
    const aggregateServiceInfo = [...historyServiceInfoMap.entries()].map(
      ([serviceName, serviceInfoList]) => {
        const endpointInfo: IHistoryEndpointInfo[] = [];
        const {
          totalRequests,
          totalRequestErrors,
          totalServerErrors,
          riskSum,
        } = serviceInfoList.reduce(
          (
            prev,
            { requests, serverErrors, requestErrors, risk, endpoints }
          ) => {
            endpointInfo.push(...endpoints);
            prev.totalRequests += requests;
            prev.totalServerErrors += serverErrors;
            prev.totalRequestErrors += requestErrors;
            prev.riskSum += risk || 0;
            return prev;
          },
          {
            totalRequests: 0,
            totalRequestErrors: 0,
            totalServerErrors: 0,
            riskSum: 0,
          }
        );

        const endpointMap =
          this.createAggregatedEndpointInfoMapping(endpointInfo);

        const latencyCVSum = [...endpointMap.values()].reduce(
          (prev, curr) => prev + curr.avgLatencyCV,
          0
        );

        const [service, namespace, version] = serviceName.split("\t");
        return {
          service,
          namespace,
          version,
          totalRequests,
          totalRequestErrors,
          totalServerErrors,
          avgRisk: riskSum / serviceInfoList.length,
          endpoints: [...endpointMap.values()],
          avgLatencyCV: latencyCVSum / endpointMap.size,
        } as IAggregateServiceInfo;
      }
    );
    const aggregateData: IAggregateData = {
      fromDate,
      toDate,
      services: aggregateServiceInfo,
    };
    return { historyData, aggregateData };
  }
  private createAggregatedEndpointInfoMapping(
    endpointInfo: IHistoryEndpointInfo[]
  ) {
    const endpointMap = new Map<
      string,
      IAggregateEndpointInfo & { latencyCV: number[] }
    >();
    endpointInfo.forEach(
      ({
        name,
        requests,
        requestErrors,
        serverErrors,
        latencyCV,
        protocol,
      }) => {
        const endpointName = `${protocol}\t${name}`;
        if (!endpointMap.has(endpointName)) {
          endpointMap.set(endpointName, {
            name,
            protocol,
            totalRequests: requests,
            totalRequestErrors: requestErrors,
            totalServerErrors: serverErrors,
            avgLatencyCV: 0,
            latencyCV: [latencyCV],
          });
        } else {
          const prev = endpointMap.get(endpointName)!;
          endpointMap.set(endpointName, {
            ...prev,
            totalRequests: prev.totalRequests + requests,
            totalRequestErrors: prev.totalRequestErrors + requestErrors,
            totalServerErrors: prev.totalServerErrors + serverErrors,
            latencyCV: [...prev.latencyCV, latencyCV],
          });
        }
      }
    );
    endpointMap.forEach((val) => {
      const sum = val.latencyCV.reduce((prev, curr) => prev + curr, 0);
      val.avgLatencyCV = sum / val.latencyCV.length;
    });
    return endpointMap;
  }
}

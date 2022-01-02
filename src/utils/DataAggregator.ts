import AggregateData from "../interfaces/AggregateData";
import EnvoyLog from "../interfaces/EnvoyLog";
import RealtimeData from "../interfaces/RealtimeData";
import ReplicaCount from "../interfaces/ReplicaCount";
import StructuredEnvoyLog from "../interfaces/StructuredEnvoyLog";
import Trace from "../interfaces/Trace";
import DataTransformer from "./DataTransformer";
import Utils from "./Utils";

export default class DataAggregator {
  static TracesAndLogsToRealtimeData(
    traces: Trace[][],
    envoyLogs: StructuredEnvoyLog[]
  ) {
    const traceMap = traces.reduce(
      (prev, curr) => prev.set(curr[0].traceId, curr),
      new Map<string, Trace[]>()
    );

    return envoyLogs
      .map((log) => log.traces)
      .flat()
      .map((trace) => {
        const traceInfo = traceMap.get(trace.traceId);
        if (!traceInfo) return;
        const span = traceInfo
          .filter((t) => t.kind === "SERVER")
          .find(
            (t) => t.tags["http.url"].split("://")[1] === trace.request.path!
          );
        if (!span) return;

        const [, , , serviceName, namespace] = Utils.ExplodeUrl(
          span.name,
          true
        );

        return {
          timestamp: span.timestamp,
          service: `${serviceName}.${namespace}`,
          version: span.tags["istio.canonical_revision"],
          protocol: trace.request.method!,
          endpointName: trace.request.path!,
          latency: span.duration,
          status: trace.response.status!,
          body: trace.response.body,
        } as RealtimeData;
      })
      .filter((data) => !!data) as RealtimeData[];
  }

  static CombineStructuredEnvoyLogs(logs: StructuredEnvoyLog[][]) {
    const logMap = new Map<
      string,
      {
        traceId: string;
        request: EnvoyLog;
        response: EnvoyLog;
      }[]
    >();

    logs.forEach((serviceLog) =>
      serviceLog.forEach((log) => {
        logMap.set(log.requestId, [
          ...(logMap.get(log.requestId) || []),
          ...log.traces,
        ]);
      })
    );

    const combinedLogs: StructuredEnvoyLog[] = [];
    for (const [requestId, traces] of logMap.entries()) {
      combinedLogs.push({
        requestId,
        traces: traces.sort((t) => t.request.timestamp.getTime()),
      });
    }
    return combinedLogs;
  }

  static TracesToAggregatedDataAndHistoryData(
    traces: Trace[][],
    replicas: ReplicaCount[] = []
  ) {
    const realtimeDataForm = DataTransformer.TracesToRealTimeData(traces);
    const serviceDependencies =
      DataTransformer.EndpointDependenciesToServiceDependencies(
        DataTransformer.TracesToEndpointDependencies(traces)
      );

    const historyData = DataTransformer.RealtimeDataToHistoryData(
      realtimeDataForm,
      serviceDependencies,
      replicas
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
    } as AggregateData;
    return { historyData, aggregateData };
  }
}

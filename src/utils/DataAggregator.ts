import EnvoyLog from "../interfaces/EnvoyLog";
import RealtimeData from "../interfaces/RealtimeData";
import StructuredEnvoyLog from "../interfaces/StructuredEnvoyLog";
import Trace from "../interfaces/Trace";
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
          serviceName: `${serviceName}.${namespace}`,
          serviceVersion: span.tags["istio.canonical_revision"],
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
}

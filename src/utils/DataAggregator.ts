import RealtimeData from "../interfaces/RealtimeData";
import StructuredEnvoyLog from "../interfaces/StructuredEnvoyLog";
import Trace from "../interfaces/Trace";

export default class DataAggregator {
  static CreateRealtimeDataFromTracesAndLogs(
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

        return {
          timestamp: span.timestamp,
          serviceName: span.tags["istio.canonical_service"],
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
}

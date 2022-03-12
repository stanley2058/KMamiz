import Logger from "../utils/Logger";
import {
  TEnvoyLog,
  TStructuredEnvoyLog,
  TStructuredEnvoyLogTrace,
} from "../entities/TEnvoyLog";

export class EnvoyLogs {
  private readonly _envoyLogs: TEnvoyLog[];
  constructor(envoyLogs: TEnvoyLog[]) {
    this._envoyLogs = envoyLogs;
  }
  get envoyLogs() {
    return this._envoyLogs;
  }

  toStructured() {
    if (this._envoyLogs.length === 0) return [];
    const logMap = new Map<string, Map<string, TEnvoyLog>>();
    this._envoyLogs.forEach((e) => {
      const id = `${e.requestId}/${e.traceId}`;
      if (!logMap.has(id)) logMap.set(id, new Map());
      logMap.get(id)!.set(e.spanId, e);
    });

    const structuredEnvoyLogs: TStructuredEnvoyLog[] = [];
    for (const [id, spanMap] of logMap.entries()) {
      const [requestId, traceId] = id.split("/");
      const traces: TStructuredEnvoyLogTrace[] = [];
      for (const [spanId, log] of spanMap.entries()) {
        if (
          log.type === "Response" &&
          spanMap.has(log.parentSpanId) &&
          spanMap.get(log.parentSpanId)!.type === "Request"
        ) {
          traces.push({
            traceId,
            spanId,
            parentSpanId: log.parentSpanId,
            request: spanMap.get(log.parentSpanId)!,
            response: log,
          });
        }
      }
      structuredEnvoyLogs.push({
        requestId,
        traces,
      });
    }
    return structuredEnvoyLogs;
  }

  static CombineToStructuredEnvoyLogs(logs: EnvoyLogs[]) {
    return this.CombineStructuredEnvoyLogs(logs.map((l) => l.toStructured()));
  }

  static CombineStructuredEnvoyLogs(logs: TStructuredEnvoyLog[][]) {
    const logMap = new Map<string, TStructuredEnvoyLogTrace[]>();

    logs.forEach((serviceLog) =>
      serviceLog.forEach((log) => {
        logMap.set(log.requestId, [
          ...(logMap.get(log.requestId) || []),
          ...log.traces,
        ]);
      })
    );

    const combinedLogs: TStructuredEnvoyLog[] = [];
    for (const [requestId, traces] of logMap.entries()) {
      combinedLogs.push({
        requestId,
        traces: traces.sort((t) => t.request.timestamp.getTime()),
      });
    }
    return combinedLogs;
  }
}

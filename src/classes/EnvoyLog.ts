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

  toJSON() {
    return this._envoyLogs;
  }

  toStructured() {
    if (this._envoyLogs.length === 0) return [];
    const logMap = new Map<string, Map<string, TEnvoyLog>>();
    const spanIds = new Set<string>();
    this._envoyLogs.forEach((e) => {
      const id = `${e.requestId}/${e.traceId}`;
      if (!logMap.has(id)) logMap.set(id, new Map());
      logMap.get(id)!.set(e.spanId, e);
      spanIds.add(e.spanId);
    });
    if (spanIds.has("NO_ID")) return this.toStructuredFallback();

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
            isFallback: false,
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

  toStructuredFallback() {
    if (this._envoyLogs.length === 0) return [];
    const logsMap = new Map<string, TEnvoyLog[]>();
    this._envoyLogs
      .filter((log) => !!log.requestId)
      .forEach((log) => {
        const id = `${log.requestId}/${log.traceId}`;
        logsMap.set(id, (logsMap.get(id) || []).concat([log]));
      });

    const structuredEnvoyLogs: TStructuredEnvoyLog[] = [];
    for (const [id, logs] of logsMap.entries()) {
      const [requestId, traceId] = id.split("/");

      let traceStack = [];
      const traceMap = new Map<string, TStructuredEnvoyLogTrace>();
      for (const log of logs) {
        if (log.type === "Request") traceStack.push(log);
        if (log.type === "Response") {
          const req = traceStack.pop();
          if (!req) {
            traceStack = [];
            continue;
          }
          traceMap.set(req.spanId, {
            traceId,
            request: req,
            response: log,
            spanId: req.spanId,
            parentSpanId: req.parentSpanId,
            isFallback: true,
          });
        }
      }

      structuredEnvoyLogs.push({
        requestId,
        traces: [...traceMap.values()],
      });
    }

    return structuredEnvoyLogs;
  }

  static CombineToStructuredEnvoyLogs(logs: EnvoyLogs[]) {
    return this.FillMissingId(
      this.CombineStructuredEnvoyLogs(logs.map((l) => l.toStructured()))
    );
  }

  static CombineStructuredEnvoyLogs(logs: TStructuredEnvoyLog[][]) {
    const logMap = new Map<string, TStructuredEnvoyLogTrace[]>();

    logs.forEach((serviceLog) =>
      serviceLog.forEach((log) => {
        logMap.set(
          log.requestId,
          (logMap.get(log.requestId) || []).concat(log.traces)
        );
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

  static FillMissingId(logs: TStructuredEnvoyLog[]) {
    // idMap<spanId, parentId>
    const idMap = new Map<string, string>();

    logs.forEach((l) => {
      l.traces.forEach((t) => {
        if (t.parentSpanId && t.parentSpanId !== "NO_ID") {
          idMap.set(`${l.requestId}/${t.spanId}`, t.parentSpanId);
        }
      });
    });
    logs.forEach((l) => {
      l.traces.forEach((t) => {
        t.parentSpanId =
          idMap.get(`${l.requestId}/${t.spanId}`) || t.parentSpanId;
      });
    });

    return logs;
  }
}

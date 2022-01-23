import Logger from "../utils/Logger";
import { IEnvoyLog, IStructuredEnvoyLog } from "../entities/IEnvoyLog";

export class EnvoyLogs {
  private readonly _envoyLogs: IEnvoyLog[];
  constructor(envoyLogs: IEnvoyLog[]) {
    this._envoyLogs = envoyLogs;
  }
  get envoyLogs() {
    return this._envoyLogs;
  }

  toStructured() {
    const logsMap = new Map<string, IEnvoyLog[]>();
    let currentRequestId = this._envoyLogs[0].requestId;
    let entropy = 0;
    let currentLogStack = [];
    for (const log of this._envoyLogs) {
      if (log.requestId !== "NO_ID" && currentRequestId !== log.requestId) {
        if (entropy === 0) logsMap.set(currentRequestId, currentLogStack);
        currentLogStack = [];
        currentRequestId = log.requestId;
      }
      if (log.type === "Request") entropy++;
      if (log.type === "Response") entropy--;
      currentLogStack.push(log);
    }

    const structuredEnvoyLogs: IStructuredEnvoyLog[] = [];
    for (const [requestId, logs] of logsMap.entries()) {
      const traces: {
        traceId: string;
        request: IEnvoyLog;
        response: IEnvoyLog;
      }[] = [];

      let traceStack = [];
      for (const log of logs) {
        if (log.type === "Request") traceStack.push(log);
        if (log.type === "Response") {
          const req = traceStack.pop();
          if (!req) {
            Logger.warn("Mismatch request response in logs");
            traceStack = [];
            continue;
          }
          traces.push({
            traceId: req.traceId!,
            request: req,
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

  static CombineStructuredEnvoyLogs(logs: IStructuredEnvoyLog[][]) {
    const logMap = new Map<
      string,
      {
        traceId: string;
        request: IEnvoyLog;
        response: IEnvoyLog;
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

    const combinedLogs: IStructuredEnvoyLog[] = [];
    for (const [requestId, traces] of logMap.entries()) {
      combinedLogs.push({
        requestId,
        traces: traces.sort((t) => t.request.timestamp.getTime()),
      });
    }
    return combinedLogs;
  }
}

import EnvoyLog from "./EnvoyLog";

export default interface StructuredEnvoyLog {
  requestId: string;
  traces: {
    traceId: string;
    request: EnvoyLog;
    response: EnvoyLog;
  }[];
}

export default interface EnvoyLog {
  namespace: string;
  podName: string;
  timestamp: Date;
  type: "Request" | "Response";
  requestId: string;
  traceId?: string;
  path?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  status?: string;
  body?: string;
}

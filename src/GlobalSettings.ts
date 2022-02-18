require("dotenv").config();
import { LogLevels } from "./utils/Logger";

type Settings = {
  Port: string;
  Timezone: string;
  ApiVersion: string;
  LogLevel: LogLevels;
  KubeApiHost: string;
  ZipkinUrl: string;
  MongoDBUri: string;
  AggregateInterval: string; // cron expression
  RealtimeInterval: string; // cron expression
  EnvoyLogLevel: "info" | "warning" | "error";
};

const {
  PORT,
  TZ,
  API_VERSION,
  LOG_LEVEL,
  KUBEAPI_HOST,
  ZIPKIN_URL,
  MONGODB_URI,
  AGGREGATE_INTERVAL,
  REALTIME_INTERVAL,
  ENVOY_LOG_LEVEL,
} = process.env;

const GlobalSettings: Settings = {
  Port: PORT || "3000",
  Timezone: TZ || "Asia/Taipei",
  ApiVersion: API_VERSION || "1",
  LogLevel: (LOG_LEVEL as LogLevels | undefined) || "info",
  KubeApiHost: KUBEAPI_HOST || "http://127.0.0.1:8080",
  ZipkinUrl: ZIPKIN_URL || "http://localhost:9411",
  MongoDBUri:
    MONGODB_URI || "mongodb://admin:admin@localhost:27017/?authSource=admin",
  // default: 00:00 everyday
  AggregateInterval: AGGREGATE_INTERVAL || "0 0 * * *",
  // default: every 5 seconds
  RealtimeInterval: REALTIME_INTERVAL || "0/5 * * * *",
  EnvoyLogLevel:
    (ENVOY_LOG_LEVEL as "info" | "warning" | "error" | undefined) || "info",
};

export default GlobalSettings;

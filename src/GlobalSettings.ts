type Settings = {
  ProhibitBodyTracingEndpoints: Set<string>;
  AggregateInterval: string; // cron expression
  RealtimeInterval: string; // cron expression
  EnvoyLogLevel: "info" | "warning" | "error";
  Timezone: string;
};

const GlobalSettings: Settings = {
  // `(${service}\t${namespace}\t${version}) ${endpointName}`
  ProhibitBodyTracingEndpoints: new Set<string>([]),
  // default: 00:00 everyday
  AggregateInterval: "0 0 * * *",
  // default: every 5 seconds
  RealtimeInterval: "0/5 * * * *",
  EnvoyLogLevel: "info",
  Timezone: "Asia/Taipei",
};
export default GlobalSettings;

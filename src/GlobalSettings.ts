type Settings = {
  ProhibitBodyTracingEndpoints: Set<string>;
  PollingInterval: number;
  EnvoyLogLevel: "info" | "warning" | "error";
  Timezone: string;
};

const GlobalSettings: Settings = {
  // `(${service}\t${namespace}\t${version}) ${endpointName}`
  ProhibitBodyTracingEndpoints: new Set<string>([]),
  PollingInterval: 5, // s
  EnvoyLogLevel: "info",
  Timezone: "Asia/Taipei",
};
export default GlobalSettings;

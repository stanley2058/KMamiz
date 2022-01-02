type Settings = {
  ProhibitBodyTracingEndpoints: Set<string>;
  PollingInterval: number;
  EnvoyLogLevel: "info" | "warning" | "error";
};

const GlobalSettings: Settings = {
  // `(${service}\t${namespace}\t${version}) ${endpointName}`
  ProhibitBodyTracingEndpoints: new Set<string>([]),
  PollingInterval: 500, // ms
  EnvoyLogLevel: "info",
};
export default GlobalSettings;

type Settings = {
  serviceEndpointsProhibitBodyTracing: Set<string>;
  pollingInterval: number;
  envoyLogLevel: "info" | "warning" | "error";
};

const GlobalSettings: Settings = {
  // `(${serviceName}-${serviceVersion}) ${endpointName}`
  serviceEndpointsProhibitBodyTracing: new Set<string>([]),
  pollingInterval: 500, // ms
  envoyLogLevel: "info",
};
export default GlobalSettings;

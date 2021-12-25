export default interface GlobalSettings {
  // `(${serviceName}-${serviceVersion}) ${endpointName}`
  serviceEndpointsProhibitBodyTracing: Set<string>;
  pollingInterval: number; // ms
}

export interface EndpointInfo {
  name: string;
  version?: string;
  serviceName: string;
  host: string;
  path: string;
  port: string;
  clusterName: string;
}

export default interface EndpointDependency {
  endpoint: EndpointInfo;
  dependencies: EndpointInfo[];
}

export default interface EndpointDependency {
  endpoint: EndpointInfo;
  // depends on
  dependencies: {
    endpoint: EndpointInfo;
    distance: number;
  }[];
}
export interface EndpointInfo {
  name: string;
  version: string;
  serviceName: string;
  namespace: string;
  host: string;
  path: string;
  port: string;
  clusterName: string;
}

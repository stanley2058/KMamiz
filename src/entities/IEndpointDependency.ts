export interface IEndpointDependency {
  endpoint: IEndpointInfo;
  // depends on
  dependsOn: {
    endpoint: IEndpointInfo;
    distance: number;
  }[];
  dependBy: {
    endpoint: IEndpointInfo;
    distance: number;
  }[];
}
export interface IEndpointInfo {
  name: string;
  service: string;
  namespace: string;
  version: string;
  host: string;
  path: string;
  port: string;
  clusterName: string;
}

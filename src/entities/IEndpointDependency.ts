export interface IEndpointDependency {
  endpoint: IEndpointInfo;
  dependsOn: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "SERVER";
  }[];
  dependBy: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "CLIENT";
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

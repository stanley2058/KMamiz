export interface IEndpointDependency {
  endpoint: IEndpointInfo;
  dependsOn: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "CLIENT";
  }[];
  dependBy: {
    endpoint: IEndpointInfo;
    distance: number;
    type: "SERVER";
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

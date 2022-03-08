export interface IServiceEndpointCohesion {
  uniqueServiceName: string;
  totalEndpoints: number;
  consumers: IServiceEndpointsConsumer[];
  endpointUsageCohesion: number;
}

export interface IServiceEndpointsConsumer {
  uniqueServiceName: string;
  consumes: number;
}

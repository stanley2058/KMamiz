export type TServiceEndpointCohesion = {
  uniqueServiceName: string;
  totalEndpoints: number;
  consumers: TServiceEndpointsConsumer[];
  endpointUsageCohesion: number;
};

export type TServiceEndpointsConsumer = {
  uniqueServiceName: string;
  consumes: number;
};

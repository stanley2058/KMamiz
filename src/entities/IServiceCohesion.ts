export interface IServiceCohesion {
  uniqueServiceName: string;
  cohesiveness: number;
  endpointCohesion: IEndpointCohesion[];
}

export interface IEndpointCohesion {
  aName: string;
  bName: string;
  score: number;
}

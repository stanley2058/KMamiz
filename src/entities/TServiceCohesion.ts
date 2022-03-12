export type TServiceCohesion = {
  uniqueServiceName: string;
  cohesiveness: number;
  endpointCohesion: TEndpointCohesion[];
};

export type TEndpointCohesion = {
  aName: string;
  bName: string;
  score: number;
};

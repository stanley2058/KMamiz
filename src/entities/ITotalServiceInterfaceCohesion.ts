import { IEndpointCohesion } from "./IServiceCohesion";
import { IServiceEndpointsConsumer } from "./IServiceEndpointCohesion";

export interface ITotalServiceInterfaceCohesion {
  uniqueServiceName: string;
  name: string;
  dataCohesion: number; // SIDC
  usageCohesion: number; // SIUC
  totalInterfaceCohesion: number; // TSIC
  endpointCohesion: IEndpointCohesion[];
  totalEndpoints: number;
  consumers: IServiceEndpointsConsumer[];
}

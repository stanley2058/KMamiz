import { TEndpointDependency } from "./TEndpointDependency";

export type TServiceDependency = {
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
  dependency: TEndpointDependency[];
  links: TServiceLink[];
};

export type TServiceLink = TServiceLinkInfo & {
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
};
export type TServiceLinkInfo = {
  count: number;
  dependingBy: number;
  dependingOn: number;
  details: TServiceLinkInfoDetail[];
};
export type TServiceLinkInfoDetail = {
  distance: number;
  count: number;
  dependingBy: number;
  dependingOn: number;
};

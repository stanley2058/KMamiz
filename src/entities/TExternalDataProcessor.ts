import { TCombinedRealtimeData } from "./TCombinedRealtimeData";
import { TEndpointDataType } from "./TEndpointDataType";
import { TEndpointDependency } from "./TEndpointDependency";

export type TExternalDataProcessorRequest = {
  uniqueId: string;
  lookBack: number; // u64
  time: number; // u64
  existingDep?: TEndpointDependency[];
};

export type TExternalDataProcessorResponse = {
  uniqueId: string;
  combined: TCombinedRealtimeData[];
  dependencies: TEndpointDependency[];
  datatype: TEndpointDataType[];
  log: string;
};

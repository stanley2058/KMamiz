import { CCombinedRealtimeData } from "./CCombinedRealtimeData";
import { CEndpointDataType } from "./CEndpointDataType";
import { CEndpointDependencies } from "./CEndpointDependencies";
import { CLabeledEndpointDependencies } from "./CLabeledEndpointDependencies";
import { CLabelMapping } from "./CLabelMapping";
import { CReplicas } from "./CReplicas";
import { CTaggedInterfaces } from "./CTaggedInterfaces";
import { CTaggedSwaggers } from "./CTaggedSwaggers";
import { CUserDefinedLabel } from "./CUserDefinedLabel";

const names = [
  CCombinedRealtimeData.uniqueName,
  CEndpointDependencies.uniqueName,
  CLabeledEndpointDependencies.uniqueName,
  CEndpointDataType.uniqueName,
  CReplicas.uniqueName,
  CLabelMapping.uniqueName,
  CUserDefinedLabel.uniqueName,
  CTaggedInterfaces.uniqueName,
  CTaggedSwaggers.uniqueName,
] as const;

export type CacheableNames = typeof names[number];

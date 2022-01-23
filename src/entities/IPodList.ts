export interface IPodList {
  kind: string;
  apiVersion: string;
  metadata: { resourceVersion: string };
  items: Item[];
}

export interface Item {
  metadata: ItemMetadata;
  spec: any;
  status: Status;
}

export interface ItemMetadata {
  name: string;
  generateName: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: Date;
  labels: Labels;
  annotations: Annotations;
  ownerReferences: OwnerReference[];
  managedFields: any[];
}

export interface Annotations {
  "kubectl.kubernetes.io/default-container": string;
  "kubectl.kubernetes.io/default-logs-container": string;
  "prometheus.io/path": string;
  "prometheus.io/port": string;
  "prometheus.io/scrape": string;
  "sidecar.istio.io/status": string;
}

export interface Labels {
  app: string;
  "pod-template-hash": string;
  "security.istio.io/tlsMode": string;
  "service.istio.io/canonical-name": string;
  "service.istio.io/canonical-revision": string;
  version: string;
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller: boolean;
  blockOwnerDeletion: boolean;
}

export interface Status {
  phase: string;
  conditions: Condition[];
  hostIP: string;
  podIP: string;
  podIPs: { ip: string }[];
  startTime: Date;
  initContainerStatuses: any[];
  containerStatuses: any[];
  qosClass: string;
}

export interface Condition {
  type: string;
  status: string;
  lastProbeTime: null;
  lastTransitionTime: Date;
}

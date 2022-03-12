export type PodList = {
  kind: string;
  apiVersion: string;
  metadata: { resourceVersion: string };
  items: Item[];
};

export type Item = {
  metadata: ItemMetadata;
  spec: any;
  status: Status;
};

export type ItemMetadata = {
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
};

export type Annotations = {
  "kubectl.kubernetes.io/default-container": string;
  "kubectl.kubernetes.io/default-logs-container": string;
  "prometheus.io/path": string;
  "prometheus.io/port": string;
  "prometheus.io/scrape": string;
  "sidecar.istio.io/status": string;
};

export type Labels = {
  app: string;
  "pod-template-hash": string;
  "security.istio.io/tlsMode": string;
  "service.istio.io/canonical-name": string;
  "service.istio.io/canonical-revision": string;
  version: string;
};

export type OwnerReference = {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller: boolean;
  blockOwnerDeletion: boolean;
};

export type Status = {
  phase: string;
  conditions: Condition[];
  hostIP: string;
  podIP: string;
  podIPs: { ip: string }[];
  startTime: Date;
  initContainerStatuses: any[];
  containerStatuses: any[];
  qosClass: string;
};

export type Condition = {
  type: string;
  status: string;
  lastProbeTime: null;
  lastTransitionTime: Date;
};

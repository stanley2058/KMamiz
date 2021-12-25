export interface ServiceList {
  kind: string;
  apiVersion: string;
  metadata: { resourceVersion: string };
  items: Item[];
}

export interface Item {
  metadata: ItemMetadata;
  spec: Spec;
  status: { loadBalancer: any };
}

export interface ItemMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: Date;
  labels: Labels;
  annotations: any;
  managedFields: any[];
}

export interface Labels {
  app: string;
  service: string;
}

export interface Spec {
  ports: Port[];
  selector: { app: string };
  clusterIP: string;
  clusterIPs: string[];
  type: string;
  sessionAffinity: string;
  ipFamilies: string[];
  ipFamilyPolicy: string;
  internalTrafficPolicy: string;
}

export interface Port {
  name: string;
  protocol: string;
  port: number;
  targetPort: number;
}

export type ServiceList = {
  kind: string;
  apiVersion: string;
  metadata: { resourceVersion: string };
  items: Item[];
};

export type Item = {
  metadata: ItemMetadata;
  spec: Spec;
  status: { loadBalancer: any };
};

export type ItemMetadata = {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: Date;
  labels: Labels;
  annotations: any;
  managedFields: any[];
};

export type Labels = {
  app: string;
  service: string;
};

export type Spec = {
  ports: Port[];
  selector: { app: string };
  clusterIP: string;
  clusterIPs: string[];
  type: string;
  sessionAffinity: string;
  ipFamilies: string[];
  ipFamilyPolicy: string;
  internalTrafficPolicy: string;
};

export type Port = {
  name: string;
  protocol: string;
  port: number;
  targetPort: number;
};

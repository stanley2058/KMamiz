export type Trace = {
  traceId: string;
  parentId?: string;
  id: string;
  kind: string;
  name: string;
  timestamp: number;
  duration: number;
  localEndpoint: {
    serviceName: string;
    ipv4: string;
  };
  annotations: {
    timestamp: number;
    value: string;
  }[];
  tags: {
    component: string;
    downstream_cluster: string;
    "guid:x-request-id": string;
    "http.method": string;
    "http.protocol": string;
    "http.status_code": string;
    "http.url": string;
    "istio.canonical_revision": string;
    "istio.canonical_service": string;
    "istio.mesh_id": string;
    "istio.namespace": string;
    node_id: string;
    "peer.address": string;
    request_size: string;
    response_flags: string;
    response_size: string;
    upstream_cluster: string;
    "upstream_cluster.name": string;
    user_agent: string;
  };
};

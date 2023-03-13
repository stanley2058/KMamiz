use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Trace {
    // add all for now, trim unused after logic implemented
    pub trace_id: String,
    pub parent_id: Option<String>,
    pub id: String,
    pub kind: String,
    pub name: String,
    pub timestamp: u64,
    pub duration: u64,
    pub local_endpoint: LocalEndpoint,
    pub annotations: Vec<Annotation>,
    pub tags: Tags,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalEndpoint {
    pub service_name: String,
    pub ipv4: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub timestamp: u64,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tags {
    pub component: String,

    #[serde(rename = "guid:x-request-id")]
    pub request_id: String,
    #[serde(rename = "http.method")]
    pub http_method: String,
    #[serde(rename = "http.protocol")]
    pub http_protocol: String,
    #[serde(rename = "http.status_code")]
    pub http_status_code: String,
    #[serde(rename = "http.url")]
    pub http_url: String,

    #[serde(rename = "istio.canonical_revision")]
    pub istio_canonical_revision: String,
    #[serde(rename = "istio.canonical_service")]
    pub istio_canonical_service: String,
    #[serde(rename = "istio.mesh_id")]
    pub istio_mesh_id: String,
    #[serde(rename = "istio.namespace")]
    pub istio_namespace: String,

    pub node_id: String,
    #[serde(rename = "peer.address")]
    pub peer_address: String,
    pub request_size: String,
    pub response_flags: String,
    pub response_size: String,
    pub upstream_cluster: String,
    #[serde(rename = "upstream_cluster.name")]
    pub upstream_cluster_name: String,
    pub user_agent: String,
}
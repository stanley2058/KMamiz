use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ServiceList {
    pub kind: String,
    #[serde(rename = "apiVersion")]
    pub api_version: String,
    pub metadata: Metadata,
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Item {
    pub metadata: ItemMetadata,
    pub spec: Spec,
    pub status: Status,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ItemMetadata {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    #[serde(rename = "resourceVersion")]
    pub resource_version: String,
    #[serde(rename = "creationTimestamp")]
    pub creation_timestamp: String,
    pub labels: Labels,
    pub annotations: serde_json::Value,
    #[serde(rename = "managedFields")]
    pub managed_fields: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Labels {
    pub app: String,
    pub service: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Spec {
    pub ports: Vec<Port>,
    pub selector: Selector,
    #[serde(rename = "clusterIP")]
    pub cluster_ip: String,
    #[serde(rename = "clusterIPs")]
    pub cluster_ips: Vec<String>,
    pub r#type: String,
    #[serde(rename = "sessionAffinity")]
    pub session_affinity: String,
    #[serde(rename = "ipFamilies")]
    pub ip_families: Vec<String>,
    #[serde(rename = "ipFamilyPolicy")]
    pub ip_family_policy: String,
    #[serde(rename = "internalTrafficPolicy")]
    pub internal_traffic_policy: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Port {
    pub name: String,
    pub protocol: String,
    pub port: u32,
    #[serde(rename = "targetPort")]
    pub target_port: u32,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Selector {
    pub app: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Status {
    #[serde(rename = "loadBalancer")]
    pub load_balancer: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Metadata {
    #[serde(rename = "resourceVersion")]
    pub resource_version: String,
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplicaCount {
    pub unique_service_name: String,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub replicas: u32,
}

use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplicaCount {
    unique_service_name: String,
    service: String,
    namespace: String,
    version: String,
    replicas: u32,
}
use super::request_type::RequestType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EndpointInfo {
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    // trace name, label
    pub label_name: Option<String>,
    pub service: String,
    pub namespace: String,
    pub version: String,
    // "http.url", true request url
    pub url: String,
    pub host: String,
    pub path: String,
    pub port: String,
    pub method: RequestType,
    pub cluster_name: String,
}

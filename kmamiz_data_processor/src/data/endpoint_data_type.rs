use super::request_type::RequestType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PartialEndpointDataType {
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub method: RequestType,
    pub requests: Vec<String>,
    pub responses: Vec<String>,
}

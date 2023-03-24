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
    pub schema: PartialEndpointDataSchema,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PartialEndpointDataSchema {
    pub time: i64,
    pub status: String,
    pub request_sample: Vec<String>,
    pub request_content_type: Option<String>,
    pub response_sample: Vec<String>,
    pub response_content_type: Option<String>,
}

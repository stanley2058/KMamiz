use super::request_type::RequestType;
use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeData {
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    pub timestamp: i64,
    pub method: RequestType,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub latency: u64,
    pub status: String,
    pub request_body: Option<String>,
    pub request_content_type: Option<String>,
    pub response_body: Option<String>,
    pub response_content_type: Option<String>,
    pub replica: Option<u32>,
}
use super::request_type::RequestType;
use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CombinedLatency {
    pub mean: f64,
    pub div_base: f64,
    pub cv: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CombinedRealtimeData {
    pub _id: Option<String>,
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    pub latest_timestamp: i64,
    pub method: RequestType,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub latency: CombinedLatency,
    pub status: String,
    pub request_body: Option<String>,
    pub request_schema: Option<String>,
    pub request_content_type: Option<String>,
    pub response_body: Option<String>,
    pub response_schema: Option<String>,
    pub response_content_type: Option<String>,
    pub avg_replica: f64,
}
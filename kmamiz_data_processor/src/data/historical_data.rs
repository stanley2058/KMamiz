use serde::{Deserialize, Serialize};

use super::request_type::RequestType;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalData {
    pub _id: Option<String>,
    pub date: i64,
    pub services: Vec<HistoricalServiceInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalServiceInfo {
    pub unique_service_name: String,
    pub date: i64,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub requests: i64,
    pub server_errors: i64,
    pub request_errors: i64,
    pub risk: Option<f64>,
    pub latency_cv: f64,
    pub endpoints: Vec<HistoricalEndpointInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalEndpointInfo {
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    pub label_name: Option<String>,
    pub method: RequestType,
    pub requests: i64,
    pub server_errors: i64,
    pub request_errors: i64,
    pub latency_cv: f64,
}

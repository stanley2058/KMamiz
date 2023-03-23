use super::request_type::RequestType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EndpointDataType {
    pub _id: Option<String>,
    pub unique_service_name: String,
    pub unique_endpoint_name: String,
    pub service: String,
    pub namespace: String,
    pub version: String,
    pub label_name: Option<String>,
    pub method: RequestType,
    pub schemas: Vec<EndpointDataSchema>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EndpointDataSchema {
    pub time: i64,
    pub status: String,
    pub request_sample: Option<String>,
    pub request_schema: Option<String>,
    pub request_content_type: Option<String>,
    pub request_params: Option<Vec<EndpointRequestParams>>,
    pub response_sample: Option<String>,
    pub response_schema: Option<String>,
    pub response_content_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EndpointRequestParams {
    param: String,
    r#type: String,
}

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

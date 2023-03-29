use super::{
    endpoint_data_type::{EndpointDataSchema, EndpointDataType},
    request_type::RequestType,
};
use serde::{Deserialize, Serialize};

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
    pub combined: usize,
    pub status: String,
    pub request_body: Option<String>,
    pub request_schema: Option<String>,
    pub request_content_type: Option<String>,
    pub response_body: Option<String>,
    pub response_schema: Option<String>,
    pub response_content_type: Option<String>,
    pub avg_replica: f64,
}

impl CombinedRealtimeData {
    pub fn extract_datatype(data: &[CombinedRealtimeData]) -> Vec<EndpointDataType> {
        data.iter()
            .map(|d| EndpointDataType {
                unique_service_name: d.unique_service_name.clone(),
                unique_endpoint_name: d.unique_endpoint_name.clone(),
                service: d.service.clone(),
                namespace: d.namespace.clone(),
                version: d.version.clone(),
                method: d.method.clone(),
                schemas: vec![EndpointDataSchema {
                    status: d.status.clone(),
                    time: d.latest_timestamp / 1000,
                    request_sample: d.request_body.clone(),
                    response_sample: d.response_body.clone(),
                    request_content_type: d.request_content_type.clone(),
                    response_content_type: d.response_content_type.clone(),
                    request_schema: d.request_schema.clone(),
                    response_schema: d.response_schema.clone(),
                    request_params: None,
                }],
                _id: None,
                label_name: None,
            })
            .collect()
    }
}

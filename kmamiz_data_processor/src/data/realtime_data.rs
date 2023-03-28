use std::collections::HashMap;

use crate::json_utils;

use super::{
    combined_realtime_data::{CombinedLatency, CombinedRealtimeData, PartialCombinedRealtimeData},
    request_type::RequestType,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

impl RealtimeData {
    pub fn combine(data: Vec<RealtimeData>) -> Vec<CombinedRealtimeData> {
        Self::complete_partial(Self::partial_combine(data))
    }

    pub fn partial_combine(data: Vec<RealtimeData>) -> Vec<PartialCombinedRealtimeData> {
        let mut name_mapping = HashMap::new();
        data.into_iter().for_each(|d| {
            let id = format!(
                "{}\t{}\t{}\t{}",
                d.unique_endpoint_name,
                d.status,
                d.request_content_type.clone().unwrap_or_default(),
                d.response_content_type.clone().unwrap_or_default()
            );
            let entry = name_mapping.entry(id).or_insert(vec![]);
            entry.push(d);
        });

        name_mapping
            .into_values()
            .map(|group| {
                let combined = group.len() as f64;
                let sample = group[0].clone();

                let mut total_latency = 0;
                let mut total_replicas = 0;
                let mut latest_timestamp = 0;
                let mut request_body = vec![];
                let mut response_body = vec![];
                let mut div_base = 0;
                for data in group.into_iter() {
                    total_latency += data.latency;
                    if let Some(body) = data.request_body {
                        request_body.push(body);
                    }
                    if let Some(body) = data.response_body {
                        response_body.push(body);
                    }
                    latest_timestamp = latest_timestamp.max(data.timestamp);
                    div_base += data.latency.pow(2);
                    if let Some(replica) = data.replica {
                        total_replicas += replica;
                    }
                }
                let div_base = RealtimeData::to_precise(div_base as f64);
                let mean = RealtimeData::to_precise(total_latency as f64 / combined);
                let cv_top = (div_base / combined - mean.powi(2)).sqrt();

                let cv = if cv_top.is_normal() {
                    RealtimeData::to_precise(cv_top / mean)
                } else {
                    0.0
                };
                let latency = CombinedLatency { mean, div_base, cv };

                PartialCombinedRealtimeData {
                    unique_service_name: sample.unique_service_name,
                    unique_endpoint_name: sample.unique_endpoint_name,
                    service: sample.service,
                    namespace: sample.namespace,
                    version: sample.version,
                    method: sample.method,
                    status: sample.status,
                    request_content_type: sample.request_content_type,
                    response_content_type: sample.response_content_type,
                    combined: combined as usize,
                    latency,
                    latest_timestamp,
                    request_body,
                    response_body,
                    avg_replica: total_replicas as f64 / combined,
                }
            })
            .collect()
    }

    pub fn complete_partial(data: Vec<PartialCombinedRealtimeData>) -> Vec<CombinedRealtimeData> {
        data.into_iter()
            .map(|d| {
                let request_body = d
                    .request_body
                    .into_iter()
                    .filter_map(|req| serde_json::from_str(&req).ok())
                    .collect::<Vec<Value>>();
                let request_body = json_utils::merge(request_body);

                let response_body = d
                    .response_body
                    .into_iter()
                    .filter_map(|res| serde_json::from_str(&res).ok())
                    .collect::<Vec<Value>>();
                let response_body = json_utils::merge(response_body);

                CombinedRealtimeData {
                    _id: None,
                    unique_service_name: d.unique_service_name,
                    unique_endpoint_name: d.unique_endpoint_name,
                    latest_timestamp: d.latest_timestamp,
                    method: d.method,
                    service: d.service,
                    namespace: d.namespace,
                    version: d.version,
                    latency: d.latency,
                    combined: d.combined,
                    status: d.status,
                    request_body: serde_json::to_string(&request_body).ok(),
                    request_schema: Some(json_utils::to_types(request_body)),
                    request_content_type: d.request_content_type,
                    response_body: serde_json::to_string(&response_body).ok(),
                    response_schema: Some(json_utils::to_types(response_body)),
                    response_content_type: d.response_content_type,
                    avg_replica: d.avg_replica,
                }
            })
            .collect()
    }

    fn to_precise(num: f64) -> f64 {
        ((num + f64::EPSILON) * 1e14).round() / 1e14
    }
}

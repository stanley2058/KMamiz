use std::collections::HashMap;

use super::{
    combined_realtime_data::{CombinedLatency, PartialCombinedRealtimeData},
    request_type::RequestType,
};
use serde::{Deserialize, Serialize};

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

    fn to_precise(num: f64) -> f64 {
        ((num + f64::EPSILON) * 1e14).round() / 1e14
    }
}

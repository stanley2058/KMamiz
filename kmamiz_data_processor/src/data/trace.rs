use std::{ collections::{ HashSet, HashMap }, str::FromStr };

use serde::{ Deserialize, Serialize };

use crate::{ data::request_type::RequestType, http_client::url_matcher::UrlMatcher };

use super::{
    envoy_log::StructuredEnvoyLog,
    replica_count::ReplicaCount,
    realtime_data::RealtimeData,
    endpoint_dependency::EndpointDependency,
    endpoint_info::EndpointInfo,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Trace {
    // add all for now, trim unused after logic implemented
    pub trace_id: String,
    pub parent_id: Option<String>,
    pub id: String,
    pub kind: String,
    pub name: String,
    pub timestamp: u64,
    pub duration: u64,
    pub local_endpoint: LocalEndpoint,
    pub annotations: Vec<Annotation>,
    pub tags: Tags,
}

impl Trace {
    pub fn extract_namespaces(traces: &Vec<Vec<Trace>>) -> HashSet<String> {
        traces
            .iter()
            .flatten()
            .map(|t| t.tags.istio_namespace.to_string())
            .collect()
    }

    pub fn combine_to_realtime_data(
        traces: &Vec<Vec<Trace>>,
        s_logs: Vec<StructuredEnvoyLog>,
        replicas: &Vec<ReplicaCount>
    ) -> Vec<RealtimeData> {
        let mut replica_map = HashMap::new();
        for replica in replicas.iter() {
            replica_map.insert(&replica.unique_service_name, replica.replicas);
        }

        let mut log_map = HashMap::new();
        for s_log in s_logs.iter() {
            if s_log.traces.len() == 0 {
                continue;
            }

            let trace_id = &s_log.traces[0].trace_id;
            let entry = log_map.entry(trace_id).or_insert(HashMap::new());
            for trace in s_log.traces.iter() {
                entry.insert(&trace.span_id, trace);
            }
        }

        traces
            .iter()
            .flatten()
            .filter(|t| t.kind == "SERVER")
            .map(|trace| -> RealtimeData {
                let service = trace.tags.istio_canonical_service.clone();
                let namespace = trace.tags.istio_namespace.clone();
                let version = trace.tags.istio_canonical_revision.clone();
                let method = RequestType::from_str(trace.tags.http_method.as_str()).unwrap();
                let status = trace.tags.http_status_code.clone();
                let unique_service_name = format!("{service}\t{namespace}\t{version}");

                let mut log = log_map.get(&trace.trace_id).and_then(|t| t.get(&trace.id));
                if
                    (log.is_none() || log.as_ref().unwrap().is_fallback) &&
                    trace.parent_id.is_some()
                {
                    log = log_map
                        .get(&trace.trace_id)
                        .and_then(|t| t.get(&trace.parent_id.as_ref().unwrap()));
                }

                RealtimeData {
                    timestamp: trace.timestamp as i64,
                    service,
                    namespace,
                    version,
                    method,
                    latency: trace.duration,
                    status,
                    request_body: log.and_then(|l| l.request.body.clone()),
                    request_content_type: log.and_then(|l| l.request.content_type.clone()),
                    response_body: log.and_then(|l| l.response.body.clone()),
                    response_content_type: log.and_then(|l| l.response.content_type.clone()),
                    unique_endpoint_name: format!(
                        "{unique_service_name}\t{}\t{}",
                        trace.tags.http_method,
                        trace.tags.http_url
                    ),
                    replica: replica_map.get(&unique_service_name).and_then(|&i| Some(i)),
                    unique_service_name,
                }
            })
            .collect()
    }

    pub fn to_endpoint_dependencies(
        traces: &Vec<Vec<Trace>>,
        url_matcher: &UrlMatcher
    ) -> Vec<EndpointDependency> {
        todo!()
    }

    pub fn to_endpoint_info(&self, url_matcher: &UrlMatcher) -> EndpointInfo {
        let url = url_matcher.explode_url(&self.tags.http_url, false);
        let mut service_url = url_matcher.explode_url(&self.name, true);
        if !self.name.contains(".svc.") {
            // probably requesting a static file from istio-ingress, fallback to using istio annotations
            service_url.service_name = Some(self.tags.istio_canonical_service.clone());
            service_url.namespace = Some(self.tags.istio_namespace.clone());
            service_url.cluster_name = Some(self.tags.istio_mesh_id.clone());
        }

        let mut version = self.tags.istio_canonical_revision.clone();
        if version.is_empty() {
            version = "NONE".to_owned();
        }

        let unique_service_name = format!(
            "{}\t{}\t{version}",
            service_url.service_name.as_ref().unwrap_or(&"".to_owned()),
            service_url.namespace.as_ref().unwrap_or(&"".to_owned())
        );

        let http_url = &self.tags.http_url;
        let method = &self.tags.http_method;

        EndpointInfo {
            version,
            service: service_url.service_name.unwrap_or_default(),
            namespace: service_url.namespace.unwrap_or_default(),
            url: http_url.clone(),
            host: url.host.unwrap_or_default(),
            path: url.path.unwrap_or_default(),
            port: url.port.unwrap_or("80".to_owned()),
            cluster_name: service_url.cluster_name.unwrap_or_default(),
            method: RequestType::from_str(&method).expect("cannot parse http method"),
            unique_endpoint_name: format!("{unique_service_name}\t{method}\t{http_url}"),
            unique_service_name,
            label_name: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalEndpoint {
    pub service_name: String,
    pub ipv4: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub timestamp: u64,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tags {
    pub component: String,

    #[serde(rename = "guid:x-request-id")]
    pub request_id: String,
    #[serde(rename = "http.method")]
    pub http_method: String,
    #[serde(rename = "http.protocol")]
    pub http_protocol: String,
    #[serde(rename = "http.status_code")]
    pub http_status_code: String,
    #[serde(rename = "http.url")]
    pub http_url: String,

    #[serde(rename = "istio.canonical_revision")]
    pub istio_canonical_revision: String,
    #[serde(rename = "istio.canonical_service")]
    pub istio_canonical_service: String,
    #[serde(rename = "istio.mesh_id")]
    pub istio_mesh_id: String,
    #[serde(rename = "istio.namespace")]
    pub istio_namespace: String,

    pub node_id: String,
    #[serde(rename = "peer.address")]
    pub peer_address: String,
    pub request_size: String,
    pub response_flags: String,
    pub response_size: String,
    pub upstream_cluster: String,
    #[serde(rename = "upstream_cluster.name")]
    pub upstream_cluster_name: String,
    pub user_agent: String,
}
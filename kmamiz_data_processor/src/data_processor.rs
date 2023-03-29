use actix_web::web::Data;
use http_client::{kubernetes::KubernetesClient, zipkin::ZipkinClient};
use log::debug;
use std::{
    collections::HashMap,
    error::Error,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    data::{
        combined_realtime_data::CombinedRealtimeData,
        connection_package::{RequestPackage, ResponsePackage},
        endpoint_dependency::EndpointDependency,
        envoy_log::EnvoyLog,
        realtime_data::RealtimeData,
        trace::Trace,
    },
    http_client::{self, url_matcher::UrlMatcher},
};

pub struct DataProcessorState {
    pub url_matcher: Arc<UrlMatcher>,
    pub zipkin: Arc<ZipkinClient>,
    pub kubernetes: Arc<KubernetesClient>,
    pub processed: Arc<Mutex<HashMap<String, i128>>>,
}

fn filter_traces(
    traces: Vec<Vec<Trace>>,
    processed: Arc<Mutex<HashMap<String, i128>>>,
) -> (Vec<Vec<Trace>>, usize, usize) {
    let mut processed = processed.lock().unwrap();
    let ori_len = traces.len();

    let traces = traces
        .into_iter()
        .filter(|t| {
            let to_process = !t.is_empty() && !processed.contains_key(&t[0].trace_id);
            if to_process {
                processed.insert(t[0].trace_id.clone(), t[0].timestamp as i128 / 1000);
            };
            to_process
        })
        .collect::<Vec<Vec<Trace>>>();

    let new_len = traces.len();
    debug!(
        "Traces: [Total: {}] [New: {}] [Filtered: {}]",
        ori_len,
        new_len,
        ori_len - new_len
    );
    (traces, ori_len, new_len)
}

fn clean_up_traces(processed: Arc<Mutex<HashMap<String, i128>>>, timeout: i128) {
    let mut processed = processed.lock().unwrap();
    let now = SystemTime::now();
    let current = now.duration_since(UNIX_EPOCH).unwrap().as_millis() as i128;

    let mut to_remove = vec![];
    for (k, ts) in processed.iter() {
        if current - ts > timeout {
            to_remove.push(k.clone());
        }
    }
    for key in to_remove.iter() {
        processed.remove(key);
    }
    debug!("Timeout traces: {}", to_remove.len());
}

pub async fn collect_data(
    request: RequestPackage,
    state: Data<DataProcessorState>,
) -> Result<ResponsePackage, Box<dyn Error>> {
    let url_matcher = state.url_matcher.clone();
    let zipkin = state.zipkin.clone();
    let kubernetes = state.kubernetes.clone();

    let traces = zipkin.get_traces(request.look_back, request.time).await?;
    let (traces, total_traces, processed_traces) = filter_traces(traces, state.processed.clone());

    let namespaces = Trace::extract_namespaces(&traces);

    let replicas = kubernetes.get_replicas(&namespaces).await?;
    let mut logs = vec![];
    for namespace in namespaces.iter() {
        for name in kubernetes.get_pod_names(namespace).await?.iter() {
            let log = kubernetes.get_envoy_logs(namespace, name).await?;
            logs.push(log);
        }
    }

    let s_logs = EnvoyLog::combine_logs(logs);
    let rl_data = Trace::combine_to_realtime_data(&traces, s_logs, &replicas);
    let dependencies = Trace::to_endpoint_dependencies(&traces, &url_matcher);
    let dependencies = if let Some(existing) = request.existing_dep {
        EndpointDependency::combine(dependencies, existing)
    } else {
        dependencies
    };

    let combined = RealtimeData::combine(rl_data);
    let datatype = CombinedRealtimeData::extract_datatype(&combined);

    clean_up_traces(state.processed.clone(), request.look_back as i128);

    debug!("Request ID: {}", request.unique_id);
    debug!("Looking back {} from {}", request.look_back, request.time);
    debug!(
        "Done data processing, with combined data: {}, dependencies: {}, datatype: {}",
        combined.len(),
        dependencies.len(),
        datatype.len(),
    );
    Ok(ResponsePackage {
        unique_id: request.unique_id,
        combined,
        dependencies,
        datatype,
        log: format!("Got {total_traces} traces, {processed_traces} new to process"),
    })
}

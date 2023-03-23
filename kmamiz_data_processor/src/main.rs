mod data;
mod env;
mod http_client;

use data::connection_package::{RequestPackage, ResponsePackage};
use http_client::{kubernetes::KubernetesClient, zipkin::ZipkinClient};
use std::{
    collections::HashMap,
    error::Error,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    data::{
        combined_realtime_data::PartialCombinedRealtimeData,
        endpoint_dependency::EndpointDependency, envoy_log::EnvoyLog, realtime_data::RealtimeData,
        trace::Trace,
    },
    http_client::url_matcher::UrlMatcher,
};

fn filter_traces(
    traces: Vec<Vec<Trace>>,
    processed: &mut HashMap<String, i128>,
) -> (Vec<Vec<Trace>>, usize, usize) {
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
    (traces, ori_len, new_len)
}

fn clean_up(processed: &mut HashMap<String, i128>, timeout: i128) {
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
}

async fn collect_data(
    request: RequestPackage,
    zipkin: ZipkinClient<'_>,
    kubernetes: KubernetesClient<'_>,
    processed: &mut HashMap<String, i128>,
) -> Result<ResponsePackage, Box<dyn Error>> {
    let url_matcher = UrlMatcher::new();

    let traces = zipkin.get_traces(request.look_back, request.time).await?;
    let (traces, total_traces, processed_traces) = filter_traces(traces, processed);

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

    let combined = RealtimeData::partial_combine(rl_data);
    let datatype = PartialCombinedRealtimeData::partial_extract_datatype(&combined);

    clean_up(processed, request.look_back as i128);

    Ok(ResponsePackage {
        unique_id: request.unique_id,
        combined,
        dependencies,
        datatype,
        log: format!("Got {total_traces} traces, {processed_traces} new to process"),
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = env::Env::new();
    let k8s_client = KubernetesClient::new(&env);
    let zipkin_client = ZipkinClient::new(&env);

    let resp = reqwest::get("https://httpbin.org/ip")
        .await?
        .json::<HashMap<String, String>>()
        .await?;
    println!("{:#?}", resp);
    println!("{:?}", k8s_client);
    println!("{:?}", zipkin_client);
    Ok(())
}

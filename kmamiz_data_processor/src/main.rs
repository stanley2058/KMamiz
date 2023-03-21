mod data;
mod env;
mod http_client;

use data::connection_package::{RequestPackage, ResponsePackage};
use http_client::{kubernetes::KubernetesClient, zipkin::ZipkinClient};
use std::{collections::HashMap, error::Error};

use crate::{
    data::{
        endpoint_dependency::EndpointDependency,
        envoy_log::EnvoyLog,
        trace::{self, Trace},
    },
    http_client::url_matcher::UrlMatcher,
};

async fn collect_data(
    request: RequestPackage,
    zipkin: ZipkinClient<'_>,
    kubernetes: KubernetesClient<'_>,
) -> Result<ResponsePackage, Box<dyn Error>> {
    // TODO: filter processed traces
    let url_matcher = UrlMatcher::new();

    let traces = zipkin.get_traces(request.look_back, request.time).await?;
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

    // TODO: partial combine to rl data list
    // TODO: partial extract data type

    todo!()
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

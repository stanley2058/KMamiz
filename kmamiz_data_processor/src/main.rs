mod data;
mod env;
mod http_client;

use data::connection_package::{RequestPackage, ResponsePackage};
use http_client::{kubernetes::KubernetesClient, zipkin::ZipkinClient};
use std::{collections::HashMap, error::Error};

async fn collect_data(
    request: RequestPackage,
    zipkin: ZipkinClient<'_>,
    kubernetes: KubernetesClient<'_>,
) -> Result<ResponsePackage, Box<dyn Error>> {
    // TODO: filter processed traces
    let traces = zipkin.get_traces(request.look_back, request.time).await?;

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

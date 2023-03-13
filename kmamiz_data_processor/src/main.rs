mod data;
mod env;
mod http_client;

use http_client::{ kubernetes::KubernetesClient, zipkin::ZipkinClient };
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = env::Env::new();
    let k8s_client = KubernetesClient::new(&env);
    let zipkin_client = ZipkinClient::new(&env);

    let resp = reqwest
        ::get("https://httpbin.org/ip").await?
        .json::<HashMap<String, String>>().await?;
    println!("{:#?}", resp);
    println!("{:?}", k8s_client);
    println!("{:?}", zipkin_client);
    Ok(())
}
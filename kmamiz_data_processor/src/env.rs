use std::env;

use dotenvy::dotenv;

#[derive(Debug)]
pub struct Env {
    pub zipkin_url: String,
    pub is_k8s: bool,
    pub kube_api_host: String,
}

impl Env {
    pub fn new() -> Self {
        dotenv().expect(".env file not found");

        let is_k8s = Env::read_env("IS_RUNNING_IN_K8S") == *"true";

        let kube_api_host = if !is_k8s {
            Env::read_env("KUBEAPI_HOST")
        } else {
            let k8s_api_host = Env::read_env("KUBERNETES_SERVICE_HOST");
            let k8s_api_port = Env::read_env("KUBERNETES_SERVICE_PORT");
            format!("https://{}:{}", k8s_api_host, k8s_api_port)
        };

        Env {
            zipkin_url: Env::read_env("ZIPKIN_URL"),
            is_k8s,
            kube_api_host,
        }
    }

    fn read_env(key: &str) -> String {
        env::var(key).unwrap_or_else(|_| panic!("{} not supplied", key))
    }
}
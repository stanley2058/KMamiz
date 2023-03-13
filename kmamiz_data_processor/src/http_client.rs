use std::{ error::Error, fs::File, io::Read };

use reqwest::{ Client, Certificate, header::HeaderMap };

use crate::{
    env::Env,
    data::{ replica_count::ReplicaCount, envoy_log::{ EnvoyLog, StructuredEnvoyLog } },
};

#[derive(Debug)]
pub struct ZipkinClient<'a> {
    client: Client,
    zipkin_url: &'a String,
}

impl<'a> ZipkinClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        ZipkinClient { client: Client::new(), zipkin_url: &env.zipkin_url }
    }
}

#[derive(Debug)]
pub struct K8sClient<'a> {
    client: Client,
    kube_api_host: &'a String,
}

impl<'a> K8sClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        let client = if env.is_k8s {
            let service_account = "/var/run/secrets/kubernetes.io/serviceaccount";
            let ca_cert_path = format!("{}/ca.crt", service_account);
            let token = format!("{}/token", service_account);

            Client::builder()
                .add_root_certificate(
                    K8sClient::read_certificate(&ca_cert_path).expect("cannot read certificate")
                )
                .default_headers(K8sClient::read_jwt_token(&token).expect("cannot read auth token"))
                .build()
                .expect("failed to build client")
        } else {
            Client::new()
        };
        K8sClient { client, kube_api_host: &env.kube_api_host }
    }

    fn read_certificate(path: &String) -> Result<Certificate, Box<dyn Error>> {
        let buf = K8sClient::read(path)?;
        Ok(Certificate::from_pem(&buf)?)
    }

    fn read_jwt_token(path: &String) -> Result<HeaderMap, Box<dyn Error>> {
        let buf = K8sClient::read(path)?;
        let token = String::from_utf8_lossy(&buf).into_owned();

        let mut headers = HeaderMap::new();
        headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
        Ok(headers)
    }

    fn read(path: &String) -> Result<Vec<u8>, Box<dyn Error>> {
        let mut buf = Vec::new();
        File::open(path)?.read_to_end(&mut buf)?;
        Ok(buf)
    }

    pub fn get_replicas(&self, namespaces: &Vec<String>) -> Result<ReplicaCount, Box<dyn Error>> {
        todo!()
    }

    pub fn get_pod_names(&self, namespace: &String) -> Result<Vec<String>, Box<dyn Error>> {
        todo!()
    }

    pub fn get_envoy_logs(
        &self,
        namespace: &String,
        pod_name: &String
    ) -> Result<EnvoyLog, Box<dyn Error>> {
        todo!()
    }
}
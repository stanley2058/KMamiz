use std::{
    collections::{HashMap, HashSet},
    error::Error,
    fs::File,
    io::Read,
};

use regex::Regex;
use reqwest::{
    header::{HeaderMap, HeaderValue},
    Certificate, Client,
};
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    data::{
        envoy_log::EnvoyLog, namespace_list::NamespaceList, pod_list::PodList,
        replica_count::ReplicaCount, service_list::ServiceList,
    },
    env::Env,
};

use super::log_matcher::LogMatcher;

#[derive(Debug)]
pub struct KubernetesClient<'a> {
    client: Client,
    kube_api_host: &'a String,
    log_matcher: LogMatcher,
}

impl<'a> KubernetesClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        let client = if env.is_k8s {
            let service_account = "/var/run/secrets/kubernetes.io/serviceaccount";
            let ca_cert_path = format!("{}/ca.crt", service_account);
            let token = format!("{}/token", service_account);

            Client::builder()
                .add_root_certificate(
                    KubernetesClient::read_certificate(&ca_cert_path)
                        .expect("cannot read certificate"),
                )
                .default_headers(
                    KubernetesClient::read_jwt_token(&token).expect("cannot read auth token"),
                )
                .build()
                .expect("failed to build client")
        } else {
            Client::new()
        };
        KubernetesClient {
            client,
            kube_api_host: &env.kube_api_host,
            log_matcher: LogMatcher::new(),
        }
    }

    fn read_certificate(path: &String) -> Result<Certificate, Box<dyn Error>> {
        let buf = KubernetesClient::read(path)?;
        Ok(Certificate::from_pem(&buf)?)
    }

    fn read_jwt_token(path: &String) -> Result<HeaderMap, Box<dyn Error>> {
        let buf = KubernetesClient::read(path)?;
        let token = String::from_utf8_lossy(&buf).into_owned();

        let mut headers = HeaderMap::new();

        headers.insert(
            "Authorization",
            HeaderValue::from_str(format!("Bearer {}", token).as_str())?,
        );
        Ok(headers)
    }

    fn read(path: &String) -> Result<Vec<u8>, Box<dyn Error>> {
        let mut buf = Vec::new();
        File::open(path)?.read_to_end(&mut buf)?;
        Ok(buf)
    }

    pub async fn get_replicas(
        &self,
        namespaces: Option<HashSet<String>>,
    ) -> Result<Vec<ReplicaCount>, Box<dyn Error>> {
        let namespaces = namespaces.unwrap_or(self.get_namespaces().await?.into_iter().collect());
        let mut replicas = vec![];
        for ns in namespaces.iter() {
            replicas = [replicas, self.get_replicas_from_pod_list(ns).await?].concat();
        }
        Ok(replicas)
    }

    pub async fn get_pod_names(&self, namespace: &String) -> Result<Vec<String>, Box<dyn Error>> {
        Ok(self
            .get_pod_list(namespace)
            .await?
            .items
            .into_iter()
            .map(|p| p.metadata.name)
            .collect())
    }

    pub async fn get_envoy_logs(
        &self,
        namespace: &String,
        pod_name: &String,
    ) -> Result<Vec<EnvoyLog>, Box<dyn Error>> {
        let url = format!(
            "{}/api/v1/namespaces/{namespace}/pods/{pod_name}/log?container=istio-proxy&tailLines={}`",
            self.kube_api_host,
            10000
        );
        let re = Regex::new(r"\twarning\tenvoy (lua|wasm)\t(script|wasm) log[^:]*: ").unwrap();
        Ok(self
            .get_str(&url)
            .await?
            .split('\n')
            .filter(|l| (l.contains("script log: ") || l.contains("wasm log ")))
            .filter_map(|l| {
                self.log_matcher
                    .parse_log(re.replace(l, "\t").to_string())
                    .ok()
            })
            .collect::<Vec<_>>())
    }

    async fn get_replicas_from_pod_list(
        &self,
        namespace: &String,
    ) -> Result<Vec<ReplicaCount>, Box<dyn Error>> {
        let pods = self.get_pod_list(namespace).await?;
        let mut replica_map: HashMap<String, ReplicaCount> = HashMap::new();
        for item in pods.items.into_iter() {
            let (service, namespace, version) = (
                item.metadata.labels.service_istio_io_canonical_name,
                item.metadata.namespace,
                item.metadata.labels.service_istio_io_canonical_revision,
            );
            let unique_service_name = format!("{service}\t{namespace}\t{version}");

            let existing = replica_map.get(&unique_service_name).map(|x| x.replicas);
            replica_map.insert(
                unique_service_name.clone(),
                ReplicaCount {
                    unique_service_name,
                    service,
                    namespace,
                    version,
                    replicas: existing.unwrap_or(0) + 1,
                },
            );
        }

        Ok(replica_map.into_values().collect())
    }

    async fn get_pod_list(&self, namespace: &String) -> Result<PodList, Box<dyn Error>> {
        let url = format!(
            "{}/api/v1/namespaces/{}/pods",
            self.kube_api_host, namespace
        );
        self.get(&url).await
    }

    async fn get_service_list(&self, namespace: &String) -> Result<ServiceList, Box<dyn Error>> {
        let url = format!(
            "{}/api/v1/namespaces/{}/services",
            self.kube_api_host, namespace
        );
        self.get(&url).await
    }

    async fn get_namespaces(&self) -> Result<Vec<String>, Box<dyn Error>> {
        let url = format!("{}/api/v1/namespaces", self.kube_api_host);
        let namespaces: NamespaceList = self.get(&url).await?;
        Ok(namespaces
            .items
            .into_iter()
            .map(|n| n.metadata.name)
            .collect())
    }

    async fn get<T: DeserializeOwned + Default>(&self, url: &String) -> Result<T, Box<dyn Error>> {
        let res = self.client.get(url).send().await?.text().await?;
        let res = serde_json::from_str::<T>(res.as_str()).unwrap_or_default();
        Ok(res)
    }

    async fn get_str(&self, url: &String) -> Result<String, Box<dyn Error>> {
        Ok(self.client.get(url).send().await?.text().await?)
    }
}

use serde::{ Deserialize, Serialize };

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PodList {
    pub kind: String,
    #[serde(rename = "apiVersion")]
    pub api_version: String,
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Item {
    pub metadata: ItemMetadata,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ItemMetadata {
    pub name: String,
    #[serde(rename = "generateName")]
    pub generate_name: String,
    pub namespace: String,
    pub uid: String,
    #[serde(rename = "resourceVersion")]
    pub resource_version: String,
    #[serde(rename = "creationTimestamp")]
    pub creation_timestamp: String,
    pub labels: Labels,
    pub annotations: Annotations,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Annotations {
    #[serde(rename = "kubectl.kubernetes.io/default-container")]
    pub kubectl_kubernetes_io_default_container: String,
    #[serde(rename = "kubectl.kubernetes.io/default-logs-container")]
    pub kubectl_kubernetes_io_default_logs_container: String,
    #[serde(rename = "prometheus.io/path")]
    pub prometheus_io_path: String,
    #[serde(rename = "prometheus.io/port")]
    pub prometheus_io_port: String,
    #[serde(rename = "prometheus.io/scrape")]
    pub prometheus_io_scrape: String,
    #[serde(rename = "sidecar.istio.io/status")]
    pub sidecar_istio_io_status: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Labels {
    pub app: String,
    #[serde(rename = "pod-template-hash")]
    pub pod_template_hash: String,
    #[serde(rename = "security.istio.io/tlsMode")]
    pub security_istio_io_tls_mode: String,
    #[serde(rename = "service.istio.io/canonical-name")]
    pub service_istio_io_canonical_name: String,
    #[serde(rename = "service.istio.io/canonical-revision")]
    pub service_istio_io_canonical_revision: String,
    pub version: String,
}
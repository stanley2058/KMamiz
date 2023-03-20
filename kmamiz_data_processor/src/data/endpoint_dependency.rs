use super::endpoint_info::EndpointInfo;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum EndpointDependencyType {
    Client,
    Server,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EndpointDependency {
    pub _id: Option<String>,
    pub endpoint: EndpointInfo,
    pub depending_on: Vec<EndpointDependencyItem>,
    pub depending_by: Vec<EndpointDependencyItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EndpointDependencyItem {
    pub endpoint: EndpointInfo,
    pub distance: u32,
    pub r#type: EndpointDependencyType,
}

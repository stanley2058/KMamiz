use super::{
    combined_realtime_data::CombinedRealtimeData, endpoint_data_type::EndpointDataType,
    endpoint_dependency::EndpointDependency,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RequestPackage {
    pub unique_id: String,
    pub look_back: u64,
    pub time: u64,
    pub existing_dep: Vec<EndpointDependency>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponsePackage {
    pub unique_id: String,
    pub rl_data_list: Vec<CombinedRealtimeData>,
    pub dependencies: Vec<EndpointDependency>,
    pub data_type: Vec<EndpointDataType>,
    pub log: String,
}

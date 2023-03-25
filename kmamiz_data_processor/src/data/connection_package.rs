use super::{
    combined_realtime_data::PartialCombinedRealtimeData,
    endpoint_data_type::PartialEndpointDataType, endpoint_dependency::EndpointDependency,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RequestPackage {
    pub unique_id: String,
    pub look_back: u64,
    pub time: u64,
    pub existing_dep: Option<Vec<EndpointDependency>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponsePackage {
    pub unique_id: String,
    pub combined: Vec<PartialCombinedRealtimeData>,
    pub dependencies: Vec<EndpointDependency>,
    pub datatype: Vec<PartialEndpointDataType>,
    pub log: String,
}

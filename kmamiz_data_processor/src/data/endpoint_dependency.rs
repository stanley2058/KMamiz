use std::{
    collections::{HashMap, HashSet},
    error::Error,
    fmt::Display,
    str::FromStr,
};

use super::endpoint_info::EndpointInfo;
use serde::{de, Deserialize, Deserializer, Serialize};

#[derive(Serialize, Debug, Clone)]
pub enum EndpointDependencyType {
    Client,
    Server,
}

#[derive(Debug)]
pub struct EndpointDependencyTypeParseError;
impl Error for EndpointDependencyTypeParseError {}
impl Display for EndpointDependencyTypeParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "error parsing from string to dependency type")
    }
}

impl FromStr for EndpointDependencyType {
    type Err = EndpointDependencyTypeParseError;
    fn from_str(input: &str) -> Result<Self, Self::Err> {
        match input.to_uppercase().as_str() {
            "CLIENT" => Ok(Self::Client),
            "SERVER" => Ok(Self::Server),
            _ => Err(EndpointDependencyTypeParseError {}),
        }
    }
}

impl<'de> Deserialize<'de> for EndpointDependencyType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        FromStr::from_str(&s).map_err(de::Error::custom)
    }
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
#[serde(rename_all = "camelCase")]
pub struct EndpointDependencyItem {
    pub endpoint: EndpointInfo,
    pub distance: u32,
    pub r#type: EndpointDependencyType,
}

#[derive(Debug, Clone)]
struct DependencyMapping {
    endpoint: EndpointDependency,
    depending_by: HashSet<String>,
    depending_on: HashSet<String>,
}

impl EndpointDependency {
    pub fn combine(
        dep1: Vec<EndpointDependency>,
        dep2: Vec<EndpointDependency>,
    ) -> Vec<EndpointDependency> {
        let mut dependency_mapping: HashMap<String, DependencyMapping> = HashMap::new();
        dep1.into_iter().for_each(|dep| {
            dependency_mapping.insert(dep.endpoint.unique_endpoint_name.clone(), dep.into());
        });
        dep2.into_iter().for_each(|dep| {
            let entry = dependency_mapping.get_mut(&dep.endpoint.unique_endpoint_name);
            if let Some(existing) = entry {
                EndpointDependency::merge_dependencies(
                    dep.depending_by,
                    &mut existing.endpoint.depending_by,
                    &mut existing.depending_by,
                );
                EndpointDependency::merge_dependencies(
                    dep.depending_on,
                    &mut existing.endpoint.depending_on,
                    &mut existing.depending_on,
                );
            } else {
                dependency_mapping.insert(dep.endpoint.unique_endpoint_name.clone(), dep.into());
            }
        });

        dependency_mapping
            .into_values()
            .map(|dep| dep.endpoint)
            .collect()
    }

    fn merge_dependencies(
        from: Vec<EndpointDependencyItem>,
        to: &mut Vec<EndpointDependencyItem>,
        reference: &mut HashSet<String>,
    ) {
        from.into_iter().for_each(|d| {
            let id = format!("{}\t{}", d.endpoint.unique_endpoint_name, d.distance);
            if reference.contains(&id) {
                return;
            }
            to.push(d);
            reference.insert(id);
        });
    }
}

impl From<EndpointDependency> for DependencyMapping {
    fn from(dep: EndpointDependency) -> Self {
        let depending_by = dep
            .depending_by
            .iter()
            .map(|dep| format!("{}\t{}", dep.endpoint.unique_endpoint_name, dep.distance))
            .collect();
        let depending_on = dep
            .depending_by
            .iter()
            .map(|dep| format!("{}\t{}", dep.endpoint.unique_endpoint_name, dep.distance))
            .collect();

        DependencyMapping {
            endpoint: dep,
            depending_by,
            depending_on,
        }
    }
}

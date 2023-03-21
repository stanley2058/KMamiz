use std::collections::{HashMap, HashSet};

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

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct NamespaceList {
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Item {
    pub metadata: Metadata,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Metadata {
    pub name: String,
}

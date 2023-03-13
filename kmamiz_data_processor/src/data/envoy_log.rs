use std::str::FromStr;

use super::request_type::RequestType;
use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum RecordType {
    Req,
    Res,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EnvoyLog {
    pub namespace: String,
    pub pod_name: String,
    pub timestamp: u64,
    pub r#type: RecordType,
    pub request_id: String,
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: String,
    pub path: Option<String>,
    pub method: Option<RequestType>,
    pub status: Option<String>,
    pub body: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StructuredEnvoyLog {
    pub request_id: String,
    pub traces: Vec<StructuredEnvoyLogTrace>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StructuredEnvoyLogTrace {
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: String,
    pub request: EnvoyLog,
    pub response: EnvoyLog,
    pub is_fallback: bool,
}

impl FromStr for RecordType {
    type Err = ();
    fn from_str(input: &str) -> Result<Self, Self::Err> {
        match input.to_uppercase().as_str() {
            "REQ" => Ok(Self::Req),
            "REQUEST" => Ok(Self::Req),
            "RES" => Ok(Self::Res),
            "RESPONSE" => Ok(Self::Res),
            _ => Err(()),
        }
    }
}

impl Into<StructuredEnvoyLog> for Vec<EnvoyLog> {
    fn into(self) -> StructuredEnvoyLog {
        todo!()
    }
}
use serde::{ Deserialize, Serialize };
use std::str::FromStr;

use super::request_type::RequestType;

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum RecordType {
    Req,
    Res,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub namespace: String,
    pub pod_name: String,
    pub request_id: String,
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: String,
    pub r#type: RecordType,
    pub timestamp: i64,
    pub body: Option<String>,
    pub content_type: Option<String>,
    pub status: Option<String>,
    pub method: Option<RequestType>,
    pub path: Option<String>,
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
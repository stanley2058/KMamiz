use super::request_type::RequestType;
use serde::{ Deserialize, Serialize };
use std::{ str::FromStr, error::Error, fmt::Display };

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EnvoyLog {
    pub namespace: String,
    pub pod_name: String,
    pub request_id: String,
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: String,
    pub r#type: LogType,
    pub timestamp: u64,
    pub body: Option<String>,
    pub content_type: Option<String>,
    pub status: Option<String>,
    pub method: Option<RequestType>,
    pub path: Option<String>,
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

impl Into<StructuredEnvoyLog> for Vec<EnvoyLog> {
    fn into(self) -> StructuredEnvoyLog {
        todo!()
    }
}

#[derive(Debug)]
pub struct EnvoyLogParseError;
impl Error for EnvoyLogParseError {}
impl Display for EnvoyLogParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "error parsing from string to record")
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum LogType {
    Req,
    Res,
}
impl FromStr for LogType {
    type Err = EnvoyLogParseError;
    fn from_str(input: &str) -> Result<Self, Self::Err> {
        match input.to_uppercase().as_str() {
            "REQ" => Ok(Self::Req),
            "REQUEST" => Ok(Self::Req),
            "RES" => Ok(Self::Res),
            "RESPONSE" => Ok(Self::Res),
            _ => Err(EnvoyLogParseError {}),
        }
    }
}
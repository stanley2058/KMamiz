use serde::{ Deserialize, Serialize };
use std::{ str::FromStr, fmt::Display, error::Error };

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum RequestType {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
    Options,
    Connect,
    Trace,
}

#[derive(Debug)]
pub struct RequestTypeParseError;
impl Error for RequestTypeParseError {}
impl Display for RequestTypeParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "error parsing from string to request type")
    }
}

impl FromStr for RequestType {
    type Err = RequestTypeParseError;
    fn from_str(input: &str) -> Result<Self, Self::Err> {
        match input.to_uppercase().as_str() {
            "GET" => Ok(Self::Get),
            "POST" => Ok(Self::Post),
            "PUT" => Ok(Self::Put),
            "PATCH" => Ok(Self::Patch),
            "DELETE" => Ok(Self::Delete),
            "HEAD" => Ok(Self::Head),
            "OPTIONS" => Ok(Self::Options),
            "CONNECT" => Ok(Self::Connect),
            "TRACE" => Ok(Self::Trace),
            _ => Err(RequestTypeParseError {}),
        }
    }
}
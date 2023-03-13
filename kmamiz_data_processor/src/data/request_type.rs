use serde::{ Deserialize, Serialize };
use std::str::FromStr;

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

impl FromStr for RequestType {
    type Err = ();
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
            _ => Err(()),
        }
    }
}
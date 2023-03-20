use super::request_type::RequestType;
use serde::{ Deserialize, Serialize };
use std::{ str::FromStr, error::Error, fmt::Display, collections::{ HashMap, HashSet } };

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

impl EnvoyLog {
    pub fn to_structure(logs: Vec<EnvoyLog>) -> Vec<StructuredEnvoyLog> {
        let mut log_map = HashMap::new();
        let mut span_ids = HashSet::new();
        for log in logs.iter() {
            let id = (&log.request_id, &log.trace_id);
            let entry = log_map.entry(id).or_insert(HashMap::new());
            entry.insert(&log.span_id, log);
            span_ids.insert(&log.span_id);
        }
        if span_ids.contains(&"NO_ID".to_owned()) {
            return EnvoyLog::to_structure_fallback(logs);
        }

        let mut structured = vec![];
        for ((request_id, trace_id), span_map) in log_map.iter() {
            let mut traces = vec![];
            for (span_id, log) in span_map.iter() {
                let existing = span_map
                    .get(&log.parent_span_id)
                    .and_then(|l| if l.r#type == LogType::Req { Some(l) } else { None });
                if log.r#type == LogType::Res && existing.is_some() {
                    traces.push(StructuredEnvoyLogTrace {
                        trace_id: trace_id.to_string(),
                        span_id: span_id.to_string(),
                        parent_span_id: log.parent_span_id.to_string(),
                        request: (*span_map.get(&log.parent_span_id).unwrap()).clone(),
                        response: (*log).clone(),
                        is_fallback: false,
                    });
                }
            }
            structured.push(StructuredEnvoyLog {
                request_id: request_id.to_string(),
                traces,
            });
        }

        structured
    }

    pub fn to_structure_fallback(logs: Vec<EnvoyLog>) -> Vec<StructuredEnvoyLog> {
        let mut log_map = HashMap::new();
        let logs = logs.iter().filter(|l| !l.request_id.is_empty());
        for log in logs {
            let id = (&log.request_id, &log.trace_id);
            let entry = log_map.entry(id).or_insert(vec![]);
            entry.push(log);
        }

        let mut structured = vec![];
        for ((request_id, trace_id), logs) in log_map.iter() {
            let mut trace_stack = vec![];
            let mut trace_map = HashMap::new();
            for log in logs.iter() {
                match log.r#type {
                    LogType::Req => trace_stack.push(log),
                    LogType::Res => {
                        if let Some(req) = trace_stack.pop() {
                            trace_map.insert(&req.span_id, StructuredEnvoyLogTrace {
                                trace_id: trace_id.to_string(),
                                span_id: req.span_id.clone(),
                                parent_span_id: req.parent_span_id.clone(),
                                request: (*req).clone(),
                                response: (*log).clone(),
                                is_fallback: true,
                            });
                        } else {
                            trace_stack.clear();
                        }
                    }
                }
            }
            structured.push(StructuredEnvoyLog {
                request_id: request_id.to_string(),
                traces: trace_map.into_values().collect(),
            });
        }

        structured
    }

    pub fn combine_logs(logs: Vec<Vec<EnvoyLog>>) -> Vec<StructuredEnvoyLog> {
        let structured = logs.into_iter().map(Self::to_structure);
        let combined = Self::combine_structured_logs(structured);
        Self::fill_missing_ids(combined)
    }

    fn combine_structured_logs<T>(s_logs: T) -> Vec<StructuredEnvoyLog>
        where T: Iterator<Item = Vec<StructuredEnvoyLog>>
    {
        let mut log_map = HashMap::new();

        for logs in s_logs {
            for mut log in logs {
                let entry = log_map.entry(log.request_id.clone()).or_insert(vec![]);
                entry.append(&mut log.traces);
            }
        }

        let mut combined = vec![];
        for (request_id, mut traces) in log_map.into_iter() {
            traces.sort_by(|a, b| a.request.timestamp.partial_cmp(&b.request.timestamp).unwrap());
            combined.push(StructuredEnvoyLog {
                request_id,
                traces,
            });
        }

        combined
    }

    fn fill_missing_ids(logs: Vec<StructuredEnvoyLog>) -> Vec<StructuredEnvoyLog> {
        let mut id_map = HashMap::new();
        for log in logs.iter() {
            for trace in log.traces.iter() {
                if trace.parent_span_id.is_empty() || trace.parent_span_id == "NO_ID" {
                    continue;
                }
                id_map.insert(
                    (log.request_id.to_string(), trace.span_id.to_string()),
                    trace.parent_span_id.to_string()
                );
            }
        }

        logs.into_iter()
            .map(|l| {
                let traces = l.traces
                    .into_iter()
                    .map(|mut t| {
                        let parent_id = id_map
                            .get(&(l.request_id.to_string(), t.span_id.to_string()))
                            .unwrap_or(&t.parent_span_id)
                            .to_string();
                        t.parent_span_id = parent_id;
                        t
                    })
                    .collect();

                StructuredEnvoyLog { request_id: l.request_id, traces }
            })
            .collect()
    }
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
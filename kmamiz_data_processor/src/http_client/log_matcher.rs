use std::{ sync::Arc, str::FromStr, error::Error, fmt::Display };

use chrono::prelude::DateTime;
use regex::Regex;

use crate::data::{ request_type::RequestType, envoy_log::{ EnvoyLog, LogType } };

static RE_METADATA: &str =
    r"\[(Request|Response) ([[:alnum:]-_]+)/([[:alnum:]_]+)/([[:alnum:]_]+)/([[:alnum:]_]+)\]";
static RE_STATUS: &str = r"\[Status\] ([0-9]+)";
static RE_PATH: &str = r"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^\]]+)";
static RE_CONTENT_TYPE: &str = r"\[ContentType ([^\]]*)]";
static RE_BODY: &str = r"\[Body\] (.*)";

#[derive(Debug)]
pub struct LogMatcher {
    metadata_matcher: Arc<Regex>,
    status_matcher: Arc<Regex>,
    path_matcher: Arc<Regex>,
    content_type_matcher: Arc<Regex>,
    body_matcher: Arc<Regex>,
}

#[derive(Debug)]
pub enum MatcherType {
    Metadata,
    Status,
    Path,
    ContentType,
    Body,
}

#[derive(Debug)]
pub struct LogParsingError<'a> {
    cause: &'a str,
}
impl<'a> LogParsingError<'a> {
    fn new(cause: &'a str) -> Box<Self> {
        Box::new(LogParsingError { cause })
    }
}
impl<'a> Error for LogParsingError<'a> {}
impl<'a> Display for LogParsingError<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "error during log parsing, {}", self.cause)
    }
}

impl LogMatcher {
    pub fn new() -> Self {
        LogMatcher {
            metadata_matcher: LogMatcher::create_matcher(RE_METADATA),
            status_matcher: LogMatcher::create_matcher(RE_STATUS),
            path_matcher: LogMatcher::create_matcher(RE_PATH),
            content_type_matcher: LogMatcher::create_matcher(RE_CONTENT_TYPE),
            body_matcher: LogMatcher::create_matcher(RE_BODY),
        }
    }

    pub fn create_matcher(pattern: &str) -> Arc<Regex> {
        Arc::new(Regex::new(pattern).unwrap())
    }

    fn matcher(&self, r#type: MatcherType) -> Arc<Regex> {
        let matcher = match r#type {
            MatcherType::Metadata => &self.metadata_matcher,
            MatcherType::Status => &self.status_matcher,
            MatcherType::Path => &self.path_matcher,
            MatcherType::ContentType => &self.content_type_matcher,
            MatcherType::Body => &self.body_matcher,
        };
        Arc::clone(matcher)
    }

    fn pattern_match(matcher: Arc<Regex>, str: &str) -> Vec<&str> {
        let captures = matcher.captures(str);
        if captures.is_none() {
            return Vec::new();
        }
        captures
            .unwrap()
            .iter()
            .map(|m| m.unwrap().as_str())
            .collect::<Vec<&str>>()
    }

    pub fn parse_log(&self, log: String) -> Result<EnvoyLog, Box<dyn Error>> {
        let splits = log.split("\t").collect::<Vec<&str>>();
        if splits.len() < 4 {
            return Err(LogParsingError::new("incorrect log tokens"));
        }
        let time = DateTime::parse_from_rfc3339(splits[0])?;
        let namespace = String::from(splits[1]);
        let pod_name = String::from(splits[2]);

        let log_body = splits[3];
        let metadata = LogMatcher::pattern_match(self.matcher(MatcherType::Metadata), log_body);

        if metadata.len() < 6 {
            return Err(LogParsingError::new("incorrect metadata tokens"));
        }
        let log_type = LogType::from_str(metadata[1])?;

        let body = Self::pattern_match(self.matcher(MatcherType::Body), log_body)
            .into_iter()
            .nth(1)
            .map(String::from);
        let content_type = Self::pattern_match(self.matcher(MatcherType::ContentType), log_body)
            .into_iter()
            .nth(1)
            .map(String::from);
        let status = Self::pattern_match(self.matcher(MatcherType::Status), log_body)
            .into_iter()
            .nth(1)
            .map(String::from);
        let mut method_and_path = Self::pattern_match(self.matcher(MatcherType::Path), log_body)
            .into_iter()
            .map(String::from);

        let method = method_and_path.nth(1).and_then(|m| RequestType::from_str(&m).ok());

        let envoy_log = EnvoyLog {
            namespace,
            pod_name,
            r#type: log_type,
            request_id: String::from(metadata[2]),
            trace_id: String::from(metadata[3]),
            span_id: String::from(metadata[4]),
            parent_span_id: String::from(metadata[5]),
            timestamp: time.timestamp_millis() as u64,
            body,
            content_type,
            status,
            method,
            path: method_and_path.nth(0),
        };

        Ok(envoy_log)
    }
}
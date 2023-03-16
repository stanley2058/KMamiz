use std::sync::Arc;

use regex::Regex;

use super::log_matcher::LogMatcher;

static IS_URL: &str = r"[a-z]+://.*";
static URL_MAIN: &str = r"://([^:/]*)([:0-9]*)(.*)";
static URL_SERVICE: &str = r"(.*).svc[\.]*(.*)";

#[derive(Debug)]
pub struct UrlMatcher {
    is_url_matcher: Arc<Regex>,
    url_matcher: Arc<Regex>,
    service_matcher: Arc<Regex>,
}

#[derive(Debug, PartialEq)]
pub struct ExplodedUrl {
    pub host: Option<String>,
    pub port: Option<String>,
    pub path: Option<String>,
    pub service_name: Option<String>,
    pub namespace: Option<String>,
    pub cluster_name: Option<String>,
}

impl UrlMatcher {
    pub fn new() -> Self {
        UrlMatcher {
            is_url_matcher: LogMatcher::create_matcher(IS_URL),
            url_matcher: LogMatcher::create_matcher(URL_MAIN),
            service_matcher: LogMatcher::create_matcher(URL_SERVICE),
        }
    }

    pub fn explode_url(&self, url: &str, is_service: bool) -> ExplodedUrl {
        let mut url = url.to_owned();
        if !self.is_url_matcher.is_match(&url) {
            url = format!("://{url}");
        }

        let mut result = ExplodedUrl {
            host: None,
            port: None,
            path: None,
            service_name: None,
            namespace: None,
            cluster_name: None,
        };

        if let Some(captures) = self.url_matcher.captures(&url) {
            result.host = captures.get(1).and_then(|c| Some(String::from(c.as_str())));
            result.port = captures.get(2).and_then(|c| Some(String::from(c.as_str())));
            result.path = captures.get(3).and_then(|c| Some(String::from(c.as_str())));
        }

        if !is_service {
            return result;
        }

        if let Some(captures) = self.service_matcher.captures(result.host.as_ref().unwrap()) {
            let service_full_name = captures.get(1).and_then(|c| Some(String::from(c.as_str())));
            if let Some(service_full_name) = service_full_name {
                let name_divider = service_full_name.rfind(".").unwrap_or_default();
                let service_name = service_full_name[0..name_divider].to_string();
                let namespace = service_full_name[name_divider + 1..].to_string();
                let cluster_name = captures.get(2).and_then(|c| Some(String::from(c.as_str())));
                result.service_name = Some(service_name);
                result.namespace = Some(namespace);
                result.cluster_name = cluster_name;
            }
        }

        result
    }
}

#[test]
pub fn test_url_matcher() {
    let matcher = UrlMatcher::new();
    let res = matcher.explode_url("http://example.com:8080/test/test", false);
    assert_eq!(res, ExplodedUrl {
        host: Some("example.com".to_owned()),
        port: Some(":8080".to_owned()),
        path: Some("/test/test".to_owned()),
        service_name: None,
        namespace: None,
        cluster_name: None,
    });

    let res = matcher.explode_url("https://192.168.1.1/test#123", false);
    assert_eq!(res, ExplodedUrl {
        host: Some("192.168.1.1".to_owned()),
        port: Some("".to_owned()),
        path: Some("/test#123".to_owned()),
        service_name: None,
        namespace: None,
        cluster_name: None,
    });

    let res = matcher.explode_url("service.test.svc.cluster.local:80/test/endpoint", false);
    assert_eq!(res, ExplodedUrl {
        host: Some("service.test.svc.cluster.local".to_owned()),
        port: Some(":80".to_owned()),
        path: Some("/test/endpoint".to_owned()),
        service_name: None,
        namespace: None,
        cluster_name: None,
    });

    let res = matcher.explode_url("service.test.svc.cluster.local:80/test/endpoint", true);
    assert_eq!(res, ExplodedUrl {
        host: Some("service.test.svc.cluster.local".to_owned()),
        port: Some(":80".to_owned()),
        path: Some("/test/endpoint".to_owned()),
        service_name: Some("service".to_owned()),
        namespace: Some("test".to_owned()),
        cluster_name: Some("cluster.local".to_owned()),
    });
}
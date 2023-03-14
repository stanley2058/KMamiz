use std::error::Error;

use reqwest::{ Client, header::{ HeaderMap, HeaderValue } };

use crate::{ env::Env, data::trace::Trace };

static SERVICE_NAME: &str = "istio-ingressgateway.istio-system";
#[derive(Debug)]
pub struct ZipkinClient<'a> {
    client: Client,
    zipkin_url: &'a String,
}

impl<'a> ZipkinClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert("Accept", HeaderValue::from_static("application/json"));
        ZipkinClient {
            client: Client::builder().default_headers(headers).gzip(true).build().unwrap(),
            zipkin_url: &env.zipkin_url,
        }
    }

    pub async fn get_traces(
        &self,
        look_back: u64,
        end_ts: u64
    ) -> Result<Vec<Vec<Trace>>, Box<dyn Error>> {
        let url = format!(
            "{}/zipkin/api/v2/traces?serviceName={}&endTs={end_ts}&lookback={look_back}&limit={}",
            self.zipkin_url,
            SERVICE_NAME,
            2500
        );

        Ok(self.client.get(url).send().await?.json().await?)
    }
}
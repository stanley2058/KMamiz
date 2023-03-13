use reqwest::Client;

use crate::env::Env;

#[derive(Debug)]
pub struct ZipkinClient<'a> {
    client: Client,
    zipkin_url: &'a String,
}

impl<'a> ZipkinClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        ZipkinClient { client: Client::new(), zipkin_url: &env.zipkin_url }
    }
}
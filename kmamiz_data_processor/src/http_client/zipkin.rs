use std::error::Error;

use reqwest::Client;

use crate::{ env::Env, data::trace::Trace };

#[derive(Debug)]
pub struct ZipkinClient<'a> {
    client: Client,
    zipkin_url: &'a String,
}

impl<'a> ZipkinClient<'a> {
    pub fn new(env: &'a Env) -> Self {
        ZipkinClient { client: Client::new(), zipkin_url: &env.zipkin_url }
    }

    pub fn get_traces(
        lookBack: u64,
        end_ts: u64,
        service_name: &String
    ) -> Result<Vec<Vec<Trace>>, Box<dyn Error>> {
        todo!()
    }
}
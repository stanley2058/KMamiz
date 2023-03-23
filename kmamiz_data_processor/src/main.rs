mod data;
mod data_processor;
mod env;
mod http_client;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use actix_web::{
    post,
    web::{Data, Json},
    App, HttpResponse, HttpServer, Responder,
};
use data::connection_package::RequestPackage;
use http_client::{kubernetes::KubernetesClient, url_matcher::UrlMatcher, zipkin::ZipkinClient};

use crate::data_processor::{collect_data, DataProcessorState};

#[post("/")]
async fn process_data(
    request: Json<RequestPackage>,
    state: Data<DataProcessorState>,
) -> impl Responder {
    let resp = collect_data(request.0, state).await;
    if let Ok(resp) = resp {
        HttpResponse::Ok().json(resp)
    } else {
        HttpResponse::BadRequest().finish()
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let env = Arc::new(env::Env::new());
    let kubernetes = Arc::new(KubernetesClient::new(env.clone()));
    let zipkin = Arc::new(ZipkinClient::new(env.clone()));
    let url_matcher = Arc::new(UrlMatcher::new());
    let processed = Arc::new(Mutex::new(HashMap::new()));

    HttpServer::new(move || {
        App::new()
            .app_data(Data::new(DataProcessorState {
                kubernetes: kubernetes.clone(),
                zipkin: zipkin.clone(),
                url_matcher: url_matcher.clone(),
                processed: processed.clone(),
            }))
            .service(process_data)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}

mod data;
mod data_processor;
mod env;
mod http_client;

use std::{
    collections::HashMap,
    io::Result,
    sync::{Arc, Mutex},
};

use actix_web::{
    get,
    middleware::Compress,
    post,
    web::{Data, Json},
    App, HttpResponse, HttpServer, Responder,
};
use data::connection_package::RequestPackage;
use env::Env;
use http_client::{kubernetes::KubernetesClient, url_matcher::UrlMatcher, zipkin::ZipkinClient};
use log::{debug, error};
use tokio::join;

use crate::data_processor::{collect_data, DataProcessorState};

#[get("/")]
async fn health() -> impl Responder {
    HttpResponse::Ok().finish()
}

#[post("/")]
async fn process_data(
    request: Json<RequestPackage>,
    state: Data<DataProcessorState>,
) -> impl Responder {
    let resp = collect_data(request.0, state).await;
    match resp {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(err) => {
            error!("{:?}", err);
            HttpResponse::BadRequest().finish()
        }
    }
}

async fn on_load(env: Arc<Env>) -> Result<()> {
    debug!("Dumping environment:\n{:#?}", env);
    Ok(())
}

#[actix_web::main]
async fn main() -> Result<()> {
    let env = Arc::new(env::Env::new());
    env_logger::init();
    let kubernetes = Arc::new(KubernetesClient::new(env.clone()));
    let zipkin = Arc::new(ZipkinClient::new(env.clone()));
    let url_matcher = Arc::new(UrlMatcher::new());
    let processed = Arc::new(Mutex::new(HashMap::new()));

    let server = HttpServer::new(move || {
        App::new()
            .app_data(Data::new(DataProcessorState {
                kubernetes: kubernetes.clone(),
                zipkin: zipkin.clone(),
                url_matcher: url_matcher.clone(),
                processed: processed.clone(),
            }))
            .wrap(Compress::default())
            .service(health)
            .service(process_data)
    })
    .bind((env.bind_ip.as_str(), env.port))?
    .run();

    let _ = join!(server, on_load(env.clone()));
    Ok(())
}

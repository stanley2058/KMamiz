use super::request_type::RequestType;

pub struct Service {
    pub unique_service_name: String,
    pub service: String,
    pub namespace: String,
    pub version: String,
}

pub struct Endpoint {
    pub service: Service,
    pub method: RequestType,
    pub unique_endpoint_name: String,
}

pub trait ToService {
    fn to_service(&self) -> Service;
}

pub trait ToEndpoint: ToService {
    fn to_endpoint(&self) -> Endpoint;
}

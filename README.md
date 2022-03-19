# KMamiz

> Kubernetes based Microservices Analyzing and Monitoring system using Istio and Zipkin

_NOTICE: This project is current in development and not ready for production, also, documents are currently under construction._

## Preconditions

Systems aim to be monitored by KMamiz need to fulfill the following requirements:

- Running on Kubernetes
- Running an Istio deployment with Zipkin enabled
- Capable to forward request headers

## Functionalities

This is a monitoring service utilizing traces from Zipkin and extended logs from Envoy proxy to provide following functionality.

- Endpoint-level dependency topology for the System Under Monitoring (SUM).
- Metrics including total requests, error amount, latency, and request/response body.
- Estimated service risk value based on multiple factors.
- Endpoint-level request dependency chain.
- Automatically generated OpenAPI documentations with Swagger UI.
- Endpoint paths guessing and path variable extraction based on request/response body and string pattern matching.
- Provides service cohesion and coupling metrics based on previous researches.
- Provides service instability metrics based on Stable Dependencies Principle (SDP) from clean architecture.

KMamiz is implemented in such way that the SUM only needs minimal intrusive changes to be monitor-able. Services in the SUM need to forward the following `X-B3` headers while making requests to other services.

- `x-request-id`
- `x-b3-traceid`
- `x-b3-spanid`
- `x-b3-parentspanid`
- `x-b3-sampled`
- `x-b3-flags`
- `x-ot-span-context`

Other than forwarding these headers, there are no other intrusive changes required to make the SUM monitor-able.

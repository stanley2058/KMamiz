# KMamiz

> Kubernetes based Microservices Analyzing and Monitoring system using Istio and Zipkin

_NOTICE: This project is currently under heavy development and is not ready for production._

## Preconditions

Systems aimed to be monitored by KMamiz need to fulfill the following requirements:

- Running on Kubernetes
- Running an Istio deployment with Zipkin enabled
- Capable of forwarding request headers

## Functionalities

KMamiz is a monitoring service utilizing traces from Zipkin and extended logs from Envoy proxy to provide the following functionality.

- Endpoint-level dependency topology for the System Under Monitoring (SUM).
- Provides metrics including total requests, error amount, and latency.
- Request/response body extraction.
- Estimated service risk value based on multiple factors.
- Endpoint-level request dependency chain.
- Automatic OpenAPI documentation generation, visualized with Swagger UI.
- Endpoint path guessing and path variable extraction based on request/response body and string pattern matching.
- Provides service cohesion and coupling metrics based on multiple research papers.
- Provides service instability metrics based on the Stable Dependencies Principle (SDP) from **_Clean Architecture_**.

KMamiz is implemented in such a way that the SUM only needs minimal intrusive changes to be monitorable. Services in the SUM need to forward the following `X-B3` headers while making requests to other services.

- `x-request-id`
- `x-b3-traceid`
- `x-b3-spanid`
- `x-b3-parentspanid`
- `x-b3-sampled`
- `x-b3-flags`
- `x-ot-span-context`

See [b3-propagation](https://github.com/openzipkin/b3-propagation) for more information.

## Try KMamiz

### Using Templates

Follow the deployment instructions [here](./deploy/README.md).

### Build KMamiz Yourself

_See [BUILD.md](BUILD.md)._

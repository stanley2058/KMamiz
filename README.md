# KMamiz

> Kubernetes-based Microservices Analyzing and Monitoring system using Istio and Zipkin

The core concept of KMamiz is to provide endpoint-level system analyzing and monitoring features, making the work for the DevOps team much more effortless.
![Concept Diagram of KMamiz](./docs/images/KMamiz%20Arch-Concept.svg)

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
- `b3`
- `x-ot-span-context`

See the [b3-propagation](https://github.com/openzipkin/b3-propagation) for more information and the [Envoy HTTP header manipulation](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_conn_man/headers.html) for details on these headers.

## Try KMamiz

### Online Demo

We currently have two online demo systems:

> We do [check the health](https://uptime.stw.tw/status/kmamiz) of these sites periodically. Nevertheless, we do not have high availability guarantee on these sites. Feel free to open an issue if any of them are down.

- [Bookinfo (Istio)](https://istio.io/latest/docs/examples/bookinfo/)
  - [Demo Site](https://kmamiz-demo.stw.tw)
- Personal Data Authorization System (PDAS)
  - This is a system previously developed by our team. The details are published in _2020 International Computer Symposium (ICS)_ and accessible [here](https://doi.org/10.1109/ICS51289.2020.00106).
  - [Demo Site](https://kmamiz-pdas-demo.stw.tw)

### Deploy Using Templates

Follow the deployment instructions [here](./deploy).

### Build KMamiz Yourself

_See [BUILD.md](BUILD.md)._

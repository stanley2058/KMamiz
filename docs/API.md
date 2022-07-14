# API

> This is the API documentation for the KMamiz system.

KMamiz's APIs are separated into five categories:

- Data
- Graph
- Swagger
- Alert
- Health

## Data

Prefix: `/api/v1/data`

### General

| Method | Full Path                                | Description                                     |
| ------ | ---------------------------------------- | ----------------------------------------------- |
| `GET`  | `/api/v1/data/aggregate/:namespace?`     | [Get aggregated data](#get_data_aggregated)     |
| `GET`  | `/api/v1/data/history/:namespace?`       | [Get historical data](#get_data_historical)     |
| `GET`  | `/api/v1/data/datatype/:uniqueLabelName` | [Get datatype by label](#get_datatype_by_label) |
| `POST` | `/api/v1/data/sync`                      | [Force data sync](#post_force_data_sync)        |

### Endpoints

| Method   | Full Path                 | Description                                           |
| -------- | ------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/v1/data/label`      | [Get all endpoint mappings](#get_endpoint_mappings)   |
| `GET`    | `/api/v1/data/label/user` | [Get user defined mappings](#get_user_mappings)       |
| `POST`   | `/api/v1/data/label/user` | [Create user defined mappings](#create_user_mappings) |
| `DELETE` | `/api/v1/data/label/user` | [Delete user defined mappings](#delete_user_mappings) |

### Interfaces

| Method   | Full Path                | Description                                          |
| -------- | ------------------------ | ---------------------------------------------------- |
| `GET`    | `/api/v1/data/interface` | [Get tagged interfaces](#get_tagged_interfaces)      |
| `POST`   | `/api/v1/data/interface` | [Create tagged interfaces](#create_tagged_interface) |
| `DELETE` | `/api/v1/data/interface` | [Delete tagged interfaces](#delete_tagged_interface) |

### Testing

> Testing endpoints provide full control over the system functionalities and MUST be used with cautions. These APIs are only exposed if the `ENABLE_TESTING_ENDPOINTS=true` environment variable is set.

| Method   | Full Path                | Description                                           |
| -------- | ------------------------ | ----------------------------------------------------- |
| `DELETE` | `/api/v1/data/clear`     | [Clear database](#testing_clear_database)             |
| `GET`    | `/api/v1/data/export`    | [Export all data](#testing_export)                    |
| `POST`   | `/api/v1/data/import`    | [Import and overwrite data](#testing_import)          |
| `POST`   | `/api/v1/data/aggregate` | [Force data aggregation schedule](#testing_aggregate) |

## Graph

Prefix: `/api/v1/graph`

| Method | Full Path                                       | Description                                                 |
| ------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/v1/graph/dependency/endpoint/:namespace?` | [Endpoint dependency graph](#get_endpoint_dependency_graph) |
| `GET`  | `/api/v1/graph/dependency/service/:namespace?`  | [Service dependency graph](#get_service_dependency_graph)   |
| `GET`  | `/api/v1/graph/chord/direct/:namespace?`        | [Direct chord diagram](#get_chord_direct)                   |
| `GET`  | `/api/v1/graph/chord/indirect/:namespace?`      | [Indirect chord diagram](#get_chord_indirect)               |
| `GET`  | `/api/v1/graph/line/:namespace?`                | [Real-time metrics](#get_metrics)                           |
| `GET`  | `/api/v1/graph/cohesion/:namespace?`            | [Cohesion metrics](#get_cohesion)                           |
| `GET`  | `/api/v1/graph/instability/:namespace?`         | [Instability metrics](#get_instability)                     |
| `GET`  | `/api/v1/graph/coupling/:namespace?`            | [Coupling metrics](#get_coupling)                           |
| `GET`  | `/api/v1/graph/requests/:uniqueName`            | [Request detail info](#get_requests)                        |

## Swagger

Prefix: `/api/v1/swagger`

| Method   | Full Path                                 | Description                                             |
| -------- | ----------------------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/v1/swagger/:uniqueServiceName`      | [Get service swagger (JSON)](#get_service_swagger_json) |
| `GET`    | `/api/v1/swagger/yaml/:uniqueServiceName` | [Get service swagger (YAML)](#get_service_swagger_yaml) |
| `GET`    | `/api/v1/swagger/tags/:uniqueServiceName` | [Get swagger version tags](#get_version_tags)           |
| `POST`   | `/api/v1/swagger/tags`                    | [Create swagger version tags](#create_version_tags)     |
| `DELETE` | `/api/v1/swagger/tags`                    | [Delete swagger version tags](#delete_version_tags)     |

## Alert

Prefix: `/api/v1/alert`

| Method | Full Path                             | Description                                       |
| ------ | ------------------------------------- | ------------------------------------------------- |
| `GET`  | `/api/v1/alert/violation/:namespace?` | [Get risk violation alerts](#get_violation_alert) |

## Health

Prefix: `/api/v1/health`

| Method | Full Path        | Description                 |
| ------ | ---------------- | --------------------------- |
| `GET`  | `/api/v1/health` | [Health check](#get_health) |

---

## Details

<span id="get_data_aggregated"></span>

### Get Aggregated Data

<span id="get_data_historical"></span>

### Get Historical Data

<span id="get_datatype_by_label"></span>

### Get DataType by Label

<span id="post_force_data_sync"></span>

### Force Data Sync

<span id="get_endpoint_mappings"></span>

### Get All Endpoint Mappings

<span id="get_user_mappings"></span>

### Get User-Defined Mappings

<span id="create_user_mappings"></span>

### Create User-Defined Mappings

<span id="delete_user_mappings"></span>

### Delete User-Defined Mappings

<span id="get_tagged_interfaces"></span>

### Get Tagged Interfaces

<span id="create_tagged_interface"></span>

### Create Tagged Interfaces

<span id="delete_tagged_interface"></span>

### Delete Tagged Interfaces

<span id="testing_clear_database"></span>

### Clear Database (Testing)

<span id="testing_export"></span>

### Export All Data (Testing)

<span id="testing_import"></span>

### Import And Overwrite Data (Testing)

<span id="testing_aggregate"></span>

### Force Data Aggregation Schedule (Testing)

<span id="get_endpoint_dependency_graph"></span>

### Get Endpoint Dependency Graph

<span id="get_service_dependency_graph"></span>

### Get Service Dependency Graph

<span id="get_chord_direct"></span>

### Get Direct Chord Diagram

<span id="get_chord_indirect"></span>

### Get Indirect Chord Diagram

<span id="get_metrics"></span>

### Get Real-time Metrics

<span id="get_cohesion"></span>

### Get Cohesion Metrics

<span id="get_instability"></span>

### Get Instability Metrics

<span id="get_coupling"></span>

### Get Coupling Metrics

<span id="get_requests"></span>

### Get Request Detail Information

<span id="get_service_swagger_json"></span>

### Get Service Swagger (JSON)

<span id="get_service_swagger_yaml"></span>

### Get Service Swagger (YAML)

<span id="get_version_tags"></span>

### Get Swagger Version Tags

<span id="create_version_tags"></span>

### Create Swagger Version Tag

<span id="delete_version_tags"></span>

### Delete Swagger Version Tag

<span id="get_violation_alert"></span>

### Get Risk Violation Alerts

<span id="get_health"></span>

### Get Service Health

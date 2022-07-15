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
| `GET`  | `/api/v1/graph/requests/:uniqueName`            | [Request detail info(#get_requests)                         |

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

### Get Aggregated Data <span id="get_data_aggregated"></span>

`GET /api/v1/data/aggregate/{namespace}`

#### Request

| Parameters  | Type  | Requirement | Description                                                  |
| ----------- | ----- | ----------- | ------------------------------------------------------------ |
| `namespace` | Path  | Optional    | Namespace filter (URL encoded)                               |
| `notBefore` | Query | Optional    | Look back time in ms                                         |
| `filter`    | Query | Optional    | Return services only if starting with `filter` (URL encoded) |

#### Response

- [TAggregatedData](../src/entities/TAggregatedData.ts)
- `undefined`

### Get Historical Data <span id="get_data_historical"></span>

`GET /api/v1/data/history/{namespace}`

#### Request

| Parameters  | Type  | Requirement | Description                    |
| ----------- | ----- | ----------- | ------------------------------ |
| `namespace` | Path  | Optional    | Namespace filter (URL encoded) |
| `notBefore` | Query | Optional    | Look back time in ms           |

#### Response

- [THistoricalData[]](../src/entities/THistoricalData.ts)

### Get DataType by Label <span id="get_datatype_by_label"></span>

`GET /api/v1/data/datatype/{uniqueLabelName}`

#### Request

| Parameters        | Type | Requirement | Description                     |
| ----------------- | ---- | ----------- | ------------------------------- |
| `uniqueLabelName` | Path | Required    | Unique label name (URL encoded) |

- Unique label name: `{service}\t{namespace}\t{version}\t{method}\t{labelName}`

#### Response

- [TEndpointDataType](../src/entities/TEndpointDataType.ts)
- HTTP 400, if label name not provided.
- HTTP 404, if the provided label cannot be resolved into its data type.

### Force Data Sync <span id="post_force_data_sync"></span>

`POST /api/v1/data/sync`

> This endpoint will automatically be called on startup if KMamiz is currently operating in Kubernetes, forcing data synchronization before launching a new instance.

#### Response

- HTTP 200, return after the sync operation is finished.

### Get All Endpoint Mappings <span id="get_endpoint_mappings"></span>

`GET /api/v1/data/label`

#### Response

- Label mapping: `[string, string][]` (`[{request path}, {endpoint label}][]`)

### Get User-Defined Mappings <span id="get_user_mappings"></span>

`GET /api/v1/data/label/user`

#### Response

- [TEndpointLabel](../src/entities/TEndpointLabel.ts)
- HTTP 404, if user-defined labels do not exist.

### Create User-Defined Mappings <span id="create_user_mappings"></span>

`POST /api/v1/data/label/user`

#### Request

- [TEndpointLabel](../src/entities/TEndpointLabel.ts)

#### Response

- HTTP 201, if created successfully.
- HTTP 400, else.

### Delete User-Defined Mappings <span id="delete_user_mappings"></span>

`DELETE /api/v1/data/label/user`

#### Request

```typescript
{
  uniqueServiceName: string;
  method: string;
  label: string;
}
```

#### Response

- HTTP 204, if deleted successfully.
- HTTP 400, else.

### Get Tagged Interfaces <span id="get_tagged_interfaces"></span>

`GET /api/v1/data/interface`

#### Request

| Parameters        | Type  | Requirement | Description                     |
| ----------------- | ----- | ----------- | ------------------------------- |
| `uniqueLabelName` | Query | Required    | Unique label name (URL encoded) |

#### Response

- [TTaggedInterface[]](../src/entities/TTaggedInterface.ts)
- HTTP 400, if label name not provided.

### Create Tagged Interfaces <span id="create_tagged_interface"></span>

`POST /api/v1/data/interface`

#### Request

- [TTaggedInterface](../src/entities/TTaggedInterface.ts)

#### Response

- HTTP 201, if created successfully.
- HTTP 400, if request body not provided.

### Delete Tagged Interfaces <span id="delete_tagged_interface"></span>

`DELETE /api/v1/data/interface`

#### Request

```typescript
{
  uniqueLabelName: string;
  userLabel: string;
}
```

#### Response

- HTTP 204, if deleted successfully.
- HTTP 400, else.

### Clear Database (Testing) <span id="testing_clear_database"></span>

`DELETE /api/v1/data/clear`

#### Response

- HTTP 200, return after the database is cleared.

### Export All Data (Testing) <span id="testing_export"></span>

`GET /api/v1/data/export`

#### Response

- ContentType: `application/tar+gzip`
- GZip content:
  ```
  export (GZipped)
  └── KMamiz.cache.json
  ```

### Import And Overwrite Data (Testing) <span id="testing_import"></span>

`POST /api/v1/data/import`

#### Request

- ContentType: `application/tar+gzip`
- GZip content:
  ```
  export (GZipped)
  └── KMamiz.cache.json
  ```

#### Response

- HTTP 201, if imported successfully.
- HTTP 400, else.

### Force Data Aggregation Schedule (Testing) <span id="testing_aggregate"></span>

`POST /api/v1/data/aggregate`

#### Response

- HTTP 204, return after the aggregation operation is finished.

### Get Endpoint Dependency Graph <span id="get_endpoint_dependency_graph"></span>

`GET /api/v1/graph/dependency/endpoint/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

- [TGraphData](../src/entities/TGraphData.ts)
- HTTP 404, if not found.

### Get Service Dependency Graph <span id="get_service_dependency_graph"></span>

`GET /api/v1/graph/dependency/service/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

- [TGraphData](../src/entities/TGraphData.ts)
- HTTP 404, if not found.

### Get Direct Chord Diagram <span id="get_chord_direct"></span>

`GET /api/v1/graph/chord/direct/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

```typescript
{
  nodes: {
    id: string;
    name: string;
  }
  [];
  links: {
    from: string;
    to: string;
    value: number;
  }
  [];
}
```

### Get Indirect Chord Diagram <span id="get_chord_indirect"></span>

`GET /api/v1/graph/chord/indirect/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

```typescript
{
  nodes: {
    id: string;
    name: string;
  }
  [];
  links: {
    from: string;
    to: string;
    value: number;
  }
  [];
}
```

### Get Real-time Metrics <span id="get_metrics"></span>

`GET /api/v1/graph/line/{namespace}`

#### Request

| Parameters  | Type  | Requirement | Description                    |
| ----------- | ----- | ----------- | ------------------------------ |
| `namespace` | Path  | Optional    | Namespace filter (URL encoded) |
| `notBefore` | Query | Optional    | Look back time in ms           |

#### Response

- [TLineChartData](../src/entities/TLineChartData.ts)

### Get Cohesion Metrics <span id="get_cohesion"></span>

`GET /api/v1/graph/cohesion/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

- [TTotalServiceInterfaceCohesion[]](../src/entities/TTotalServiceInterfaceCohesion.ts)

### Get Instability Metrics <span id="get_instability"></span>

`GET /api/v1/graph/instability/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

```typescript
{
  uniqueServiceName: string;
  name: string;
  dependingBy: number;
  dependingOn: number;
  instability: number;
}
[];
```

### Get Coupling Metrics <span id="get_coupling"></span>

`GET /api/v1/graph/coupling/{namespace}`

#### Request

| Parameters  | Type | Requirement | Description                    |
| ----------- | ---- | ----------- | ------------------------------ |
| `namespace` | Path | Optional    | Namespace filter (URL encoded) |

#### Response

```typescript
{
  uniqueServiceName: string;
  name: string;
  ais: number;
  ads: number;
  acs: number;
}
[];
```

### Get Request Detail Information <span id="get_requests"></span>

`GET /api/v1/graph/requests/{uniqueName}`

#### Request

| Parameters   | Type  | Requirement | Description                     |
| ------------ | ----- | ----------- | ------------------------------- |
| `uniqueName` | Path  | Required    | Unique label name (URL encoded) |
| `notBefore`  | Query | Optional    | Look back time in ms            |

#### Response

- [TRequestInfoChartData](../src/entities/TRequestInfoChartData.ts)

### Get Service Swagger (JSON) <span id="get_service_swagger_json"></span>

`GET /api/v1/swagger/{uniqueServiceName}`

#### Request

| Parameters          | Type  | Requirement | Description                          |
| ------------------- | ----- | ----------- | ------------------------------------ |
| `uniqueServiceName` | Path  | Required    | Unique service name (URL encoded)    |
| `tag`               | Query | Optional    | Tagged swagger version (URL encoded) |

- Unique service name: `{service}\t{namespace}\t{version}`

#### Response

- OpenAPIV3_1.Document
- HTTP 400, if service not found.

### Get Service Swagger (YAML) <span id="get_service_swagger_yaml"></span>

`GET /api/v1/swagger/yaml/{uniqueServiceName}`

#### Request

| Parameters          | Type  | Requirement | Description                          |
| ------------------- | ----- | ----------- | ------------------------------------ |
| `uniqueServiceName` | Path  | Required    | Unique service name (URL encoded)    |
| `tag`               | Query | Optional    | Tagged swagger version (URL encoded) |

- Unique service name: `{service}\t{namespace}\t{version}`

#### Response

- OpenAPIV3_1.Document (in YAML form)
- HTTP 400, if service not found.

### Get Swagger Version Tags <span id="get_version_tags"></span>

`GET /api/v1/swagger/tags/{uniqueServiceName}`

#### Request

| Parameters          | Type | Requirement | Description                       |
| ------------------- | ---- | ----------- | --------------------------------- |
| `uniqueServiceName` | Path | Required    | Unique service name (URL encoded) |

- Unique service name: `{service}\t{namespace}\t{version}`

#### Response

- `string[]`
- HTTP 400, if service not found.

### Create Swagger Version Tag <span id="create_version_tags"></span>

`POST /api/v1/swagger/tags`

#### Request

- [TTaggedSwagger](../src/entities/TTaggedSwagger.ts)

#### Response

- HTTP 200
- HTTP 400, if body not presented.

### Delete Swagger Version Tag <span id="delete_version_tags"></span>

`DELETE /api/v1/swagger/tags`

#### Request

```typescript
{
  uniqueServiceName: string;
  tag: string;
}
```

#### Response

- HTTP 200
- HTTP 400, if body not presented.

### Get Risk Violation Alerts <span id="get_violation_alert"></span>

`GET /api/v1/alert/violation/{namespace}`

#### Request

| Parameters  | Type  | Requirement | Description                    |
| ----------- | ----- | ----------- | ------------------------------ |
| `namespace` | Path  | Optional    | Namespace filter (URL encoded) |
| `notBefore` | Query | Optional    | Look back time in ms           |

#### Response

- [TRiskViolation[]](../src/entities/TRiskViolation.ts)

### Get Service Health <span id="get_health"></span>

`GET /api/v1/health`

#### Response

```typescript
{
  status: "UP";
  serverTime: number;
}
```

import { OpenAPIV3_1 } from "openapi-types";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import {
  TEndpointDataType,
  TEndpointRequestParam,
} from "../entities/TEndpointDataType";
import DataCache from "../services/DataCache";
import Utils from "./Utils";

export default class SwaggerUtils {
  static FromEndpoints(
    title: string,
    version: string,
    endpoints: TEndpointDataType[]
  ): OpenAPIV3_1.Document {
    const endpointMapping = endpoints.reduce((prev, curr) => {
      prev.set(curr.labelName!, [...(prev.get(curr.labelName!) || []), curr]);
      return prev;
    }, new Map<string, TEndpointDataType[]>());

    const paths = [...endpointMapping.entries()].reduce(
      (acc, [label, endpoints]): OpenAPIV3_1.PathsObject => {
        const paths = endpoints.reduce(
          (prev, e): OpenAPIV3_1.PathItemObject => ({
            ...prev,
            ...this.EndpointDataTypeToPathItem(e),
          }),
          {}
        );
        return {
          ...acc,
          [label]: paths,
        };
      },
      {}
    );

    const swagger: OpenAPIV3_1.Document = {
      openapi: "3.0.1",
      info: {
        title,
        version,
      },
      paths,
      components: {},
    };
    return swagger;
  }

  static EndpointDataTypeToPathItem(
    endpoint: TEndpointDataType
  ): OpenAPIV3_1.PathItemObject {
    const responses = endpoint.schemas.reduce((acc, s) => {
      const base: any = { [s.status]: { description: s.status } };
      if (s.responseSample) {
        base[s.status]["content"] = {
          "application/json": {
            schema: Utils.MapObjectToOpenAPITypes(s.responseSample),
          },
        };
      }
      return { ...acc, ...base };
    }, {});
    const requests = endpoint.schemas.reduce(
      (prev, curr) => ({ ...prev, ...curr.requestSample }),
      {}
    );
    const requestBody =
      Object.keys(requests).length > 0
        ? {
            content: {
              "application/json": {
                schema: Utils.MapObjectToOpenAPITypes(requests),
              },
            },
          }
        : undefined;

    const parameters = endpoint.schemas
      .reduce(
        (prev, curr) => prev.concat(curr.requestParams || []),
        [] as TEndpointRequestParam[]
      )
      .map((p) => {
        return {
          in: "query",
          name: p.param,
          schema: { type: p.type },
        };
      });

    const endpoints = DataCache.getInstance()
      .get<CLabelMapping>("LabelMapping")
      .getEndpointsFromLabel(endpoint.labelName!);
    if (endpoints.length === 0) endpoints.push(endpoint.labelName!);
    const exampleUrls = endpoints
      .slice(0, 10)
      .map((e) => {
        const token = e.split("\t");
        return `  - ${token[token.length - 1]}`;
      })
      .join("\n");
    const description = `**Recorded examples:**\n\n${exampleUrls}`;

    switch (endpoint.method) {
      case "POST":
        return {
          post: {
            responses: responses as any,
            requestBody,
            description,
          },
        };
      case "PUT":
        return {
          put: {
            responses: responses as any,
            requestBody,
            description,
          },
        };
      case "DELETE":
        return {
          delete: {
            responses: responses as any,
            requestBody,
            description,
          },
        };
      default:
        return {
          get: {
            responses: responses as any,
            parameters: parameters as any,
            description,
          },
        };
    }
  }
}

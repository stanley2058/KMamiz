import { OpenAPIV3_1 } from "openapi-types";
import IEndpointDataType from "../entities/IEndpointDataType";
import Utils from "./Utils";

export default class SwaggerUtils {
  static FromEndpoints(
    title: string,
    version: string,
    endpoints: IEndpointDataType[]
  ) {
    const endpointMapping = endpoints.reduce((prev, curr) => {
      prev.set(curr.labelName, [...(prev.get(curr.labelName) || []), curr]);
      return prev;
    }, new Map<string, IEndpointDataType[]>());
    const paths = [...endpointMapping.entries()].reduce(
      (acc, [label, endpoints]): OpenAPIV3_1.PathsObject => {
        const paths = endpoints.reduce(
          (prev, e): OpenAPIV3_1.PathItemObject => ({
            ...prev,
            ...this.EndpointDataTypeToPathItem(e),
          }),
          {}
        );

        const path = `/${label.split("/")[1]}`;
        return {
          ...acc,
          [path]: paths,
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
    endpoint: IEndpointDataType
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

    switch (endpoint.method) {
      case "POST":
        return {
          post: {
            responses: responses as any,
            requestBody,
          },
        };
      case "PUT":
        return {
          put: {
            responses: responses as any,
            requestBody,
          },
        };
      case "DELETE":
        return {
          delete: {
            responses: responses as any,
            requestBody,
          },
        };
      default:
        return {
          get: {
            responses: responses as any,
          },
        };
    }
  }
}

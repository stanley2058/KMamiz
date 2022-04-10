import IRequestHandler from "../entities/TRequestHandler";
import SwaggerUtils from "../utils/SwaggerUtils";
import YAML from "yamljs";
import DataCache from "../services/DataCache";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CTaggedSwaggers } from "../classes/Cacheable/CTaggedSwaggers";
import { OpenAPIV3_1 } from "openapi-types";
import { TTaggedSwagger } from "../entities/TTaggedSwagger";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { TEndpointDataSchema } from "../entities/TEndpointDataType";
import EndpointDataType from "../classes/EndpointDataType";

export default class SwaggerService extends IRequestHandler {
  constructor() {
    super("swagger");
    this.addRoute("get", "/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      const { tag } = req.query as { tag: string };
      if (!uniqueServiceName) res.sendStatus(400);
      else {
        res.json(this.getSwagger(decodeURIComponent(uniqueServiceName), tag));
      }
    });
    this.addRoute("get", "/yaml/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      const { tag } = req.query as { tag: string };
      if (!uniqueServiceName) res.sendStatus(400);
      else {
        const yaml = YAML.stringify(
          this.getSwagger(decodeURIComponent(uniqueServiceName), tag)
        );
        res.type("yaml").send(yaml);
      }
    });
    this.addRoute("get", "/tags/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      if (!uniqueServiceName) res.sendStatus(400);
      else {
        res.json(this.getTags(decodeURIComponent(uniqueServiceName)));
      }
    });
    this.addRoute("post", "/tags", async (req, res) => {
      const tagged = req.body as TTaggedSwagger;
      if (!tagged) res.sendStatus(400);
      else {
        res.json(this.addTaggedSwagger(tagged));
      }
    });
    this.addRoute("delete", "/tags", async (req, res) => {
      const { uniqueServiceName, tag } = req.body as {
        uniqueServiceName: string;
        tag: string;
      };
      if (!uniqueServiceName || !tag) res.sendStatus(400);
      else {
        res.json(this.deleteTaggedSwagger(uniqueServiceName, tag));
      }
    });
  }

  getSwagger(uniqueServiceName: string, tag?: string) {
    if (tag) {
      const existing = DataCache.getInstance()
        .get<CTaggedSwaggers>("TaggedSwaggers")
        .getData(uniqueServiceName, tag);
      if (existing.length > 0) {
        const swagger = JSON.parse(
          existing[0].openApiDocument
        ) as OpenAPIV3_1.Document;
        swagger.info.version = tag;
        return swagger;
      }
    }

    const [service, namespace, version] = uniqueServiceName.split("\t");
    const endpoints = DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .getData()
      .filter((e) => e.toJSON().uniqueServiceName === uniqueServiceName);

    return SwaggerUtils.FromEndpoints(
      `${service}.${namespace}`,
      version,
      endpoints.map((e) => {
        e.toJSON().labelName = DataCache.getInstance()
          .get<CLabelMapping>("LabelMapping")
          .getLabelFromUniqueEndpointName(e.toJSON().uniqueEndpointName);
        return e.toJSON();
      })
    );
  }

  getTags(uniqueServiceName: string) {
    return DataCache.getInstance()
      .get<CTaggedSwaggers>("TaggedSwaggers")
      .getData(uniqueServiceName)
      .sort((a, b) => b.time! - a.time!)
      .map((t) => t.tag);
  }

  addTaggedSwagger(tagged: TTaggedSwagger) {
    DataCache.getInstance().get<CTaggedSwaggers>("TaggedSwaggers").add(tagged);
    const dataTypes = DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .getData()
      .filter((d) => d.toJSON().uniqueServiceName === tagged.uniqueServiceName);

    const mergedDataTypeMap = new Map<string, EndpointDataType>();
    dataTypes.forEach((d) => {
      const name = d.toJSON().labelName!;
      const existing = mergedDataTypeMap.get(name);
      mergedDataTypeMap.set(name, existing ? existing.mergeSchemaWith(d) : d);
    });

    [...mergedDataTypeMap.values()].forEach((d) => {
      const dt = d.toJSON();
      const statusMap = new Map<string, TEndpointDataSchema>();
      dt.schemas
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .forEach((s) => statusMap.set(s.status, s));

      [...statusMap.values()].forEach((s) => {
        const schema = {
          timestamp: s.time.getTime(),
          requestSchema: s.requestSchema || "",
          responseSchema: s.responseSchema || "",
          userLabel: `${tagged.tag}-${s.status}`,
          uniqueLabelName: `${dt.uniqueServiceName}\t${dt.method}\t${dt.labelName}`,
          boundToSwagger: true,
        };
        DataCache.getInstance()
          .get<CTaggedInterfaces>("TaggedInterfaces")
          .add(schema);
      });
    });
  }

  deleteTaggedSwagger(uniqueServiceName: string, tag: string) {
    DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .getData()
      .filter(
        (i) =>
          i.boundToSwagger &&
          i.uniqueLabelName.startsWith(uniqueServiceName) &&
          i.userLabel.startsWith(`${tag}-`)
      )
      .forEach((i) =>
        DataCache.getInstance()
          .get<CTaggedInterfaces>("TaggedInterfaces")
          .delete(i.uniqueLabelName, i.userLabel)
      );

    DataCache.getInstance()
      .get<CTaggedSwaggers>("TaggedSwaggers")
      .delete(uniqueServiceName, tag);
  }
}

import IRequestHandler from "../entities/TRequestHandler";
import SwaggerUtils from "../utils/SwaggerUtils";
import YAML from "yamljs";
import DataCache from "../services/DataCache";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";

export default class SwaggerService extends IRequestHandler {
  constructor() {
    super("swagger");
    this.addRoute("get", "/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      const { tag } = req.query as { tag: string };
      if (!uniqueServiceName) res.sendStatus(400);
      else
        res.json(
          await this.getSwagger(decodeURIComponent(uniqueServiceName), tag)
        );
    });
    this.addRoute("get", "/yaml/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      const { tag } = req.query as { tag: string };
      if (!uniqueServiceName) res.sendStatus(400);
      else {
        const yaml = YAML.stringify(
          await this.getSwagger(decodeURIComponent(uniqueServiceName), tag)
        );
        res.type("yaml").send(yaml);
      }
    });
  }

  async getSwagger(uniqueServiceName: string, tag?: string) {
    if (tag) {
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
}

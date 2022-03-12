import IRequestHandler from "../entities/TRequestHandler";
import SwaggerUtils from "../utils/SwaggerUtils";
import YAML from "yamljs";
import DataCache from "../services/DataCache";

export default class SwaggerService extends IRequestHandler {
  constructor() {
    super("swagger");
    this.addRoute("get", "/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      if (!uniqueServiceName) res.sendStatus(400);
      else
        res.json(await this.getSwagger(decodeURIComponent(uniqueServiceName)));
    });
    this.addRoute("get", "/yaml/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      if (!uniqueServiceName) res.sendStatus(400);
      else {
        const yaml = YAML.stringify(
          await this.getSwagger(decodeURIComponent(uniqueServiceName))
        );
        res.type("yaml").send(yaml);
      }
    });
  }

  async getSwagger(uniqueServiceName: string) {
    const [service, namespace, version] = uniqueServiceName.split("\t");
    const endpoints = DataCache.getInstance().endpointDataTypeSnap.filter(
      (e) => e.toJSON().uniqueServiceName === uniqueServiceName
    );

    return SwaggerUtils.FromEndpoints(
      `${service}.${namespace}`,
      version,
      endpoints.map((e) => {
        e.toJSON().labelName =
          DataCache.getInstance().getLabelFromUniqueEndpointName(
            e.toJSON().uniqueEndpointName
          );
        return e.toJSON();
      })
    );
  }
}

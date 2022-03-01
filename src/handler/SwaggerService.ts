import IRequestHandler from "../entities/IRequestHandler";
import SwaggerUtils from "../utils/SwaggerUtils";
import MongoOperator from "../services/MongoOperator";
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
    const endpoints =
      await MongoOperator.getInstance().getEndpointDataTypeByService(
        uniqueServiceName
      );

    return SwaggerUtils.FromEndpoints(
      `${service}.${namespace}`,
      version,
      endpoints.map((e) => {
        e.endpointDataType.labelName =
          DataCache.getInstance().getLabelFromUniqueEndpointName(
            e.endpointDataType.uniqueEndpointName
          );
        return e.endpointDataType;
      })
    );
  }
}

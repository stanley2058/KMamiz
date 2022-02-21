import IRequestHandler from "../entities/IRequestHandler";
import swaggerUi from "swagger-ui-express";
import SwaggerUtils from "../utils/SwaggerUtils";
import MongoOperator from "../services/MongoOperator";

export default class SwaggerService extends IRequestHandler {
  constructor() {
    super("swagger");
    this.addRoute("get", "/:uniqueServiceName", async (req, res) => {
      const uniqueServiceName = req.params?.uniqueServiceName;
      if (!uniqueServiceName) res.sendStatus(400);
      else
        res
          .type("html")
          .send(await this.getSwagger(decodeURIComponent(uniqueServiceName)));
    });
  }

  async getSwagger(uniqueServiceName: string) {
    const [service, namespace, version] = uniqueServiceName.split("\t");
    const endpoints =
      await MongoOperator.getInstance().getEndpointDataTypeByService(
        uniqueServiceName
      );
    return swaggerUi.generateHTML(
      SwaggerUtils.FromEndpoints(
        `${service}.${namespace}`,
        version,
        endpoints.map((e) => e.endpointDataType)
      )
    );
  }
}

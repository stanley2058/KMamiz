import { EndpointDependencyModel } from "../../entities/schema/EndpointDependencySchema";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import { EndpointDependencies } from "../EndpointDependencies";
import { Cacheable } from "./Cacheable";

export class CEndpointDependencies extends Cacheable<EndpointDependencies> {
  static readonly uniqueName = "EndpointDependencies";
  constructor(initData?: EndpointDependencies) {
    super("EndpointDependencies", initData);
    this.setInit(async () => {
      this.setData(
        new EndpointDependencies(
          await MongoOperator.getInstance().findAll(EndpointDependencyModel)
        )
      );
    });
    this.setSync(async () => {
      const dependencies = this.getData();
      const dependenciesToDelete = await MongoOperator.getInstance().findAll(
        EndpointDependencyModel
      );

      if (dependencies) {
        try {
          await MongoOperator.getInstance().insertMany(
            dependencies.toJSON(),
            EndpointDependencyModel
          );
          await MongoOperator.getInstance().delete(
            dependenciesToDelete.map((d) => d._id!),
            EndpointDependencyModel
          );
        } catch (ex) {
          Logger.error(`Error saving ${this.name}, skipping.`);
          Logger.verbose("", ex);
        }
      }
    });
  }

  setData(update: EndpointDependencies): void {
    super.setData(update.trim());
  }

  getData(namespace?: string): EndpointDependencies | undefined {
    const data = super.getData();
    if (namespace && data) {
      return new EndpointDependencies(
        data.toJSON().filter((d) => d.endpoint.namespace === namespace)
      );
    }
    return data;
  }
}

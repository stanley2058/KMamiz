import MongoOperator from "../../services/MongoOperator";
import { EndpointDependencies } from "../EndpointDependencies";
import { Cacheable } from "./Cacheable";

export class CEndpointDependencies extends Cacheable<EndpointDependencies> {
  constructor(initData?: EndpointDependencies) {
    super("EndpointDependencies", initData);
  }

  setData(update: EndpointDependencies): void {
    super.setData(update.trim());
    this.setInit(async () => {
      this.setData(await MongoOperator.getInstance().getEndpointDependencies());
    });
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

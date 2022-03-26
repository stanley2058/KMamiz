import { EndpointDependencies } from "../EndpointDependencies";
import { Cacheable } from "./Cacheable";

export class CLabeledEndpointDependencies extends Cacheable<EndpointDependencies> {
  static readonly uniqueName = "LabeledEndpointDependencies";
  constructor(initData?: EndpointDependencies) {
    super("LabeledEndpointDependencies", initData);
  }

  setData(update: EndpointDependencies): void {
    super.setData(new EndpointDependencies(update.trim().label()));
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

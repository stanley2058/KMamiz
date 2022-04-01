import { TEndpointDependency } from "../../entities/TEndpointDependency";
import { EndpointDependencies } from "../EndpointDependencies";
import { Cacheable } from "./Cacheable";

export class CLabeledEndpointDependencies extends Cacheable<EndpointDependencies> {
  static readonly uniqueName = "LabeledEndpointDependencies";
  constructor(initData?: TEndpointDependency[]) {
    super(
      "LabeledEndpointDependencies",
      initData && new EndpointDependencies(initData)
    );
  }

  setData(update: EndpointDependencies): void {
    super.setData(new EndpointDependencies(update.trim().label()));
  }

  label() {
    const data = super.getData();
    if (!data) return;
    this.setData(new EndpointDependencies(data.label()));
  }

  getData(namespace?: string): EndpointDependencies | undefined {
    this.label();
    const data = super.getData();
    if (namespace && data) {
      return new EndpointDependencies(
        data.toJSON().filter((d) => d.endpoint.namespace === namespace)
      );
    }
    return data;
  }
}

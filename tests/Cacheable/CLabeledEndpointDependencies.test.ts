import { CLabeledEndpointDependencies } from "../../src/classes/Cacheable/CLabeledEndpointDependencies";
import { EndpointDependencies } from "../../src/classes/EndpointDependencies";

describe("Cacheable LabeledEndpointDependencies", () => {
  const cache = new CLabeledEndpointDependencies();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("set data", () => {
    cache.setData(new EndpointDependencies([]));
    expect(cache.getData()).toBeTruthy();
  });
});

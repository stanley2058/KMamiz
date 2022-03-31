import "../../src/classes/Cacheable";
import { CEndpointDependencies } from "../../src/classes/Cacheable/CEndpointDependencies";
import { EndpointDependencies } from "../../src/classes/EndpointDependencies";

describe("Cacheable EndpointDependencies", () => {
  const cache = new CEndpointDependencies();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("set data", () => {
    cache.setData(new EndpointDependencies([]));
    expect(cache.getData()).toBeTruthy();
  });
});

import { CEndpointDataType } from "../../src/classes/Cacheable/CEndpointDataType";

describe("Cacheable EndpointDataType", () => {
  const cache = new CEndpointDataType();

  it("get data", () => {
    expect(cache.getData()).toBeTruthy();
  });

  it("set data", () => {
    cache.setData([]);
    expect(cache.getData()).toBeTruthy();
  });
});

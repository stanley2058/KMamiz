import "../../src/classes/Cacheable";
import { CReplicas } from "../../src/classes/Cacheable/CReplicas";

describe("Cacheable Replicas", () => {
  const cache = new CReplicas();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("set data", () => {
    cache.setData([]);
    expect(cache.getData()).toBeTruthy();
  });
});

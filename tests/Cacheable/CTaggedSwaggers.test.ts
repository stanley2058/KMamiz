import "../../src/classes/Cacheable";
import { CTaggedSwaggers } from "../../src/classes/Cacheable/CTaggedSwaggers";

describe("Cacheable TaggedSwaggers", () => {
  const cache = new CTaggedSwaggers();
  it("get data", () => {
    expect(cache.getData().length).toEqual(0);
  });

  it("add", () => {
    cache.add({
      openApiDocument: "",
      tag: "labelA",
      uniqueServiceName: "service\tnamespace\tversion",
    });
    expect(cache.getData().length).toEqual(1);
  });

  it("delete", () => {
    cache.delete("service\tnamespace\tversion", "labelA");
    expect(cache.getData().length).toEqual(0);
  });
});

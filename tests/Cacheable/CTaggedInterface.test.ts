import { CTaggedInterfaces } from "../../src/classes/Cacheable/CTaggedInterfaces";

describe("Cacheable TaggedInterfaces", () => {
  const cache = new CTaggedInterfaces();
  it("get data", () => {
    expect(cache.getData().length).toEqual(0);
  });

  it("add", () => {
    cache.add({
      requestSchema: "",
      responseSchema: "",
      uniqueLabelName: "labelA",
      userLabel: "labelA",
    });
    expect(cache.getData().length).toEqual(1);
  });

  it("delete", () => {
    cache.delete("labelA", "labelA");
    expect(cache.getData().length).toEqual(0);
  });
});

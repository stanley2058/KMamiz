import { CUserDefinedLabel } from "../../src/classes/Cacheable/CUserDefinedLabel";

describe("Cacheable UserDefinedLabel", () => {
  const cache = new CUserDefinedLabel();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("add", () => {
    cache.add({
      labels: [
        {
          label: "labelA",
          method: "GET",
          samples: ["123"],
          uniqueServiceName: "service\tnamespace\tversion",
        },
      ],
    });
    expect(cache.getData()?.labels.length).toEqual(1);
  });

  it("update", () => {
    cache.update({
      labels: [
        {
          label: "labelA",
          method: "GET",
          samples: ["234"],
          uniqueServiceName: "service\tnamespace\tversion",
        },
      ],
    });
    expect(cache.getData()?.labels.length).toEqual(1);
    expect(cache.getData()?.labels[0].samples[0]).toEqual("234");
  });

  it("delete", () => {
    cache.delete("labelA", "service\tnamespace\tversion", "GET");
    expect(cache.getData()?.labels.length).toEqual(0);
  });
});

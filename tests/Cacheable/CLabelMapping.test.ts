import "../../src/classes/Cacheable";
import { CLabelMapping } from "../../src/classes/Cacheable/CLabelMapping";
import { MockAggregatedData, MockHistoricalData } from "../MockData";

describe("Cacheable LabelMapping", () => {
  const cache = new CLabelMapping();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("set data", () => {
    const map = new Map<string, string>();
    map.set(
      "service\tnamespace\tversion\tmethod\thttp://srv/endpointA",
      "labelA"
    );
    map.set(
      "service\tnamespace\tversion\tmethod\thttp://srv/endpointB",
      "labelA"
    );
    map.set(
      "service\tnamespace\tversion\tmethod\thttp://srv/endpointC",
      "labelB"
    );
    cache.setData(map);

    expect(cache.getData()).toBeTruthy();
    expect(cache.getData()!.size).toEqual(map.size);
  });

  it("label history data and aggregate data", () => {
    expect(cache.labelHistoricalData(MockHistoricalData)).toEqual(
      MockHistoricalData
    );
    expect(cache.labelAggregatedData(MockAggregatedData)).toEqual(
      MockAggregatedData
    );
  });

  it("get EndpointDataType by label", () => {
    expect(
      cache.getEndpointDataTypesByLabel(
        "labelA",
        "service\tnamespace\tversion",
        "GET",
        []
      )
    ).toEqual([]);
  });

  it("get label from unique endpoint name", () => {
    expect(
      cache.getLabelFromUniqueEndpointName(
        "service\tnamespace\tversion\tmethod\thttp://srv/endpointC"
      )
    ).toEqual("labelB");
    expect(
      cache.getLabelFromUniqueEndpointName(
        "service\tnamespace\tversion\tmethod\thttp://srv/endpointD"
      )
    ).toEqual("/endpointD");
  });

  it("get endpoints from label", () => {
    expect(cache.getEndpointsFromLabel("labelA")).toEqual([
      "service\tnamespace\tversion\tmethod\thttp://srv/endpointA",
      "service\tnamespace\tversion\tmethod\thttp://srv/endpointB",
    ]);
  });
});

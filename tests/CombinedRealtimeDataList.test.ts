import CombinedRealtimeDataList from "../src/classes/CombinedRealtimeDataList";
import {
  MockBaseCrlData1,
  MockDependencies,
  MockReplicas,
  MockHistoricalData,
  MockAggregatedData,
  MockEndpointDataType,
  MockBaseRlData1,
  MockBaseCrlData2,
  MockCombinedBaseData,
  Namespace,
} from "./MockData";

describe("CombinedRealtimeDataList", () => {
  it("converts to HistoricalData", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const h = data.toHistoricalData(MockDependencies, MockReplicas);
    expect(h).toEqual(MockHistoricalData);
  });

  it("converts to AggregatedData and HistoricalData", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const { aggregatedData: a, historicalData: h } =
      data.toAggregatedDataAndHistoricalData(MockDependencies, MockReplicas);

    expect(h).toEqual(MockHistoricalData);
    expect(a).toEqual(MockAggregatedData);
  });

  it("extracts EndpointDataType", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const dataType = data.extractEndpointDataType().map((d) => d.toJSON());
    expect(dataType).toEqual(MockEndpointDataType);
  });

  it("combines with another list", () => {
    const data1 = new CombinedRealtimeDataList(MockBaseCrlData1);
    const data2 = new CombinedRealtimeDataList(MockBaseCrlData2);

    const combined = data1.combineWith(data2);
    expect(combined.toJSON()).toEqual(MockCombinedBaseData);
  });

  it("provides containing namespaces", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    expect([...data.getContainingNamespaces()]).toEqual([Namespace]);
  });
});

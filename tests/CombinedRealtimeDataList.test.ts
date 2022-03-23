import CombinedRealtimeDataList from "../src/classes/CombinedRealtimeDataList";
import {
  MockBaseCrlData1,
  MockDependencies,
  MockReplicas,
  MockHistoryData,
  MockAggregateData,
  MockEndpointDataType,
  MockBaseRlData1,
  MockBaseCrlData2,
  MockCombinedBaseData,
  Namespace,
} from "./MockData";

describe("CombinedRealtimeDataList", () => {
  it("converts to HistoryData", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const h = data.toHistoryData(MockDependencies, MockReplicas);
    expect(h).toEqual(MockHistoryData);
  });

  it("converts to AggregateData and HistoryData", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const { aggregateData: a, historyData: h } =
      data.toAggregatedDataAndHistoryData(MockDependencies, MockReplicas);

    expect(h).toEqual(MockHistoryData);
    expect(a).toEqual(MockAggregateData);
  });

  it("extracts EndpointDataType", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const dataType = data.extractEndpointDataType().map((d) => d.toJSON());
    expect(dataType).toEqual(MockEndpointDataType);
  });

  it("converts back into RealtimeData", () => {
    const data = new CombinedRealtimeDataList(MockBaseCrlData1);
    const rlData = data.toRealtimeDataForm();
    expect(rlData).toEqual(MockBaseRlData1);
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

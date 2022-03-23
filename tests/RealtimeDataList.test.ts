import { RealtimeDataList } from "../src/classes/RealtimeDataList";
import { MockBaseCrlData1, MockBaseRlData1, Namespace } from "./MockData";

describe("RealtimeDataList", () => {
  it("gets containing namespaces", () => {
    const rlData = new RealtimeDataList(MockBaseRlData1);
    expect([...rlData.getContainingNamespaces()]).toEqual([Namespace]);
  });

  it("converts to combined realtime data", () => {
    const rlData = new RealtimeDataList(MockBaseRlData1);
    expect(rlData.toCombinedRealtimeData().toJSON()).toEqual(MockBaseCrlData1);
  });
});

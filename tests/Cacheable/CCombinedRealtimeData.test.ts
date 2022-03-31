import { CCombinedRealtimeData } from "../../src/classes/Cacheable/CCombinedRealtimeData";
import CombinedRealtimeDataList from "../../src/classes/CombinedRealtimeDataList";

describe("Cacheable CombinedRealtimeData", () => {
  const cache = new CCombinedRealtimeData();

  it("get data", () => {
    expect(cache.getData()).toBeUndefined();
  });

  it("set data", () => {
    cache.setData(new CombinedRealtimeDataList([]));
    expect(cache.getData()).toBeTruthy();
  });

  it("reset data", () => {
    cache.reset();
    expect(cache.getData()).toBeFalsy();
  });
});

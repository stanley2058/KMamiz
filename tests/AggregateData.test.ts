import { AggregatedData } from "../src/classes/AggregatedData";
import {
  MockAggregatedData1,
  MockAggregatedData2,
  MockMergedAggregatedData,
} from "./MockData";

describe("AggregatedData", () => {
  it("merges with another AggregatedData", () => {
    const m = new AggregatedData(MockAggregatedData1).combine(
      MockAggregatedData2
    );
    expect(m.toJSON()).toEqual(MockMergedAggregatedData);
  });
});

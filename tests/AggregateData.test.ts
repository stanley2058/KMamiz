import { AggregateData } from "../src/classes/AggregateData";
import {
  MockAggregateData1,
  MockAggregateData2,
  MockMergedAggregateData,
} from "./MockData";

describe("AggregateData", () => {
  it("merges with another AggregateData", () => {
    const m = new AggregateData(MockAggregateData1).combine(MockAggregateData2);
    expect(m.toJSON()).toEqual(MockMergedAggregateData);
  });
});

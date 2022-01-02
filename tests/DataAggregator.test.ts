import DataAggregator from "../src/utils/DataAggregator";
import DataTransformer from "../src/utils/DataTransformer";
import { MockLogs, MockTrace } from "./MockData";

describe("DataAggregator", () => {
  const logs = DataTransformer.EnvoyLogsToStructureEnvoyLogs(MockLogs);

  /**
   * DataAggregator.TracesAndLogsToRealtimeData
   * Skipping testing for TracesAndLogsToRealtimeData due to
   * insufficient mock data, MockTrace and MockLogs needs to
   * be in-sync for the function to work properly.
   */

  it("combines structure logs", () => {
    expect(
      DataAggregator.CombineStructuredEnvoyLogs([logs, logs])
    ).toHaveLength(logs.length);
  });

  it("creates aggregated data and history data from traces", () => {
    const data = DataAggregator.TracesToAggregatedDataAndHistoryData(MockTrace);
    expect(data).toHaveProperty("historyData");
    expect(data).toHaveProperty("aggregateData");
    expect(data.historyData).toHaveLength(1);
  });
});

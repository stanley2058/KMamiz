import { EnvoyLogs } from "../src/classes/EnvoyLog";
import { Trace } from "../src/classes/Trace";
import { MockLogs, MockTrace } from "./MockData";

describe("DataAggregator", () => {
  const logs = new EnvoyLogs(MockLogs).toStructured();

  /**
   * DataAggregator.TracesAndLogsToRealtimeData
   * Skipping testing for TracesAndLogsToRealtimeData due to
   * insufficient mock data, MockTrace and MockLogs needs to
   * be in-sync for the function to work properly.
   */

  it("combines structure logs", () => {
    expect(EnvoyLogs.CombineStructuredEnvoyLogs([logs, logs])).toHaveLength(
      logs.length
    );
  });

  it("creates aggregated data and history data from traces", () => {
    const data = new Trace(MockTrace).toAggregatedDataAndHistoryData();
    expect(data).toHaveProperty("historyData");
    expect(data).toHaveProperty("aggregateData");
    expect(data.historyData).toHaveLength(1);
  });
});

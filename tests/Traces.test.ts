import { Traces } from "../src/classes/Traces";
import {
  MockEndpointDependenciesPDAS,
  MockEndpointInfoPDAS1,
  MockRlDataPDAS,
  MockTracePDAS,
} from "./MockData";

describe("Traces", () => {
  const trace = new Traces([MockTracePDAS]);

  it("converts to realtime data", () => {
    const rlData = trace.toRealTimeData();
    expect(rlData.toJSON()).toEqual(MockRlDataPDAS);
  });

  it("converts to endpoint dependencies", () => {
    const dependencies = trace.toEndpointDependencies();
    expect(dependencies.toJSON()).toEqual(MockEndpointDependenciesPDAS);
  });

  it("converts to endpoint info", () => {
    const t = MockTracePDAS[0];
    expect(Traces.ToEndpointInfo(t)).toEqual(MockEndpointInfoPDAS1);
  });
});

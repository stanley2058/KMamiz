import KubernetesService from "../src/services/KubernetesService";
import { MockLogsPDAS } from "./MockData";

describe("EnvoyLog", () => {
  const logs = KubernetesService.ParseEnvoyLogs(
    MockLogsPDAS,
    "pdas",
    "user-service"
  );

  it("convert logs to structure logs", () => {
    expect(logs.toJSON().length).toEqual(MockLogsPDAS.length);
    expect(logs.toStructured()).toBeTruthy();
  });
});

import EndpointDataType from "../src/classes/EndpointDataType";
import EndpointUtils from "../src/utils/EndpointUtils";
import Utils from "../src/utils/Utils";
import {
  Method,
  MockEndpointDataType,
  Service,
  UniversalEndpointBaseData,
} from "./MockData";

describe("EndpointUtils", () => {
  it("creates endpoint label mapping", () => {
    const labelMap = EndpointUtils.CreateEndpointLabelMapping(
      MockEndpointDataType.map((e) => new EndpointDataType(e))
    );
    const epName = UniversalEndpointBaseData.uniqueEndpointName;
    const path = epName
      .replace(UniversalEndpointBaseData.uniqueServiceName, "")
      .replace(`${Method}\t`, "");

    const [, , p] = Utils.ExplodeUrl(path);
    expect(labelMap.get(epName)).toEqual(p);
  });

  it("guesses endpoints", () => {
    const labelMap = new Map<string, string>();
    labelMap.set(UniversalEndpointBaseData.uniqueEndpointName, "/api/{}");
    const baseName = UniversalEndpointBaseData.uniqueServiceName + "\tGET\t";
    const endpoints = [
      "http://srv/api/a",
      "http://srv/api/b",
      "http://srv/api/user/123",
    ].map((e) => baseName + e);

    const newMap = EndpointUtils.GuessAndMergeEndpoints(endpoints, labelMap);
    expect(newMap.get(endpoints[1])).toEqual("/api/{}");
    expect(newMap.size).toEqual(2);
  });
});

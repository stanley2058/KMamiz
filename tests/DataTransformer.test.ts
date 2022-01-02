import EndpointDependency from "../src/interfaces/EndpointDependency";
import RealtimeData from "../src/interfaces/RealtimeData";
import ServiceDependency from "../src/interfaces/ServiceDependency";
import DataTransformer from "../src/utils/DataTransformer";

import { MockEndpointDependencies, MockLogs, MockTrace } from "./MockData";

describe("DataTransformer", () => {
  let endpointDependencies: EndpointDependency[];
  let realtimeData: RealtimeData[];
  let serviceDependency: ServiceDependency[];

  it("converts traces to endpoint dependencies", () => {
    endpointDependencies =
      DataTransformer.TracesToEndpointDependencies(MockTrace);
    expect(endpointDependencies).toHaveLength(6);
    expect(endpointDependencies).toContainEqual(MockEndpointDependencies[0]);
  });

  it("converts endpoint dependencies to graph data", () => {
    const graphData =
      DataTransformer.EndpointDependenciesToGraphData(endpointDependencies);
    expect(graphData.nodes).toHaveLength(10);
    expect(graphData.links).toHaveLength(18);
  });

  it("converts traces to realtime data", () => {
    realtimeData = DataTransformer.TracesToRealTimeData(MockTrace);
    expect(realtimeData).toHaveLength(MockTrace.flat().length / 2);
  });

  it("converts endpoint dependencies to service dependencies", () => {
    serviceDependency =
      DataTransformer.EndpointDependenciesToServiceDependencies(
        endpointDependencies
      );
    expect(serviceDependency).toHaveLength(endpointDependencies.length);
  });

  it("converts trace to endpoint info", () => {
    const info = DataTransformer.TraceToEndpointInfo(MockTrace[0][0]);
    expect(info).toEqual({
      name: "ratings.book.svc.cluster.local:9080/*",
      version: "v1",
      service: "ratings",
      namespace: "book",
      host: "ratings",
      path: "/ratings/0",
      port: ":9080",
      clusterName: "cluster.local",
    });
  });

  it("converts EnvoyLogs to StructureEnvoyLogs", () => {
    const structuredEnvoyLogs =
      DataTransformer.EnvoyLogsToStructureEnvoyLogs(MockLogs);
    expect(structuredEnvoyLogs).toEqual([
      {
        requestId: "e8c54b43-d810-912c-8b08-e4c2f6249b19",
        traces: [
          {
            traceId: "50398473642538df0f1c5fa1b6aebbfb",
            request: {
              timestamp: new Date("2022-01-01T06:48:31.057Z"),
              type: "Request",
              requestId: "e8c54b43-d810-912c-8b08-e4c2f6249b19",
              traceId: "50398473642538df0f1c5fa1b6aebbfb",
              method: "GET",
              path: "details:9080/details/0",
              namespace: "book",
              podName: "details-v1-7dcb9897f-pnxxc",
            },
            response: {
              timestamp: new Date("2022-01-01T06:48:31.058Z"),
              type: "Response",
              requestId: "NO_ID",
              status: "200",
              body: '{"id":0,"author":"William Shakespeare","year":1595,"type":"paperback","pages":200,"publisher":"PublisherA","language":"English","ISBN-10":"1234567890","ISBN-13":"123-1234567890"}',
              namespace: "book",
              podName: "details-v1-7dcb9897f-pnxxc",
            },
          },
        ],
      },
      {
        requestId: "e3ca2764-766b-9b8f-8384-bd893cd76dab",
        traces: [
          {
            traceId: "1b6ddec1c9e5f94d54d23b8322eef960",
            request: {
              timestamp: new Date("2022-01-01T06:48:32.705Z"),
              type: "Request",
              requestId: "e3ca2764-766b-9b8f-8384-bd893cd76dab",
              traceId: "1b6ddec1c9e5f94d54d23b8322eef960",
              method: "GET",
              path: "details:9080/details/0",
              namespace: "book",
              podName: "details-v1-7dcb9897f-pnxxc",
            },
            response: {
              timestamp: new Date("2022-01-01T06:48:32.706Z"),
              type: "Response",
              requestId: "NO_ID",
              status: "200",
              body: '{"id":0,"author":"William Shakespeare","year":1595,"type":"paperback","pages":200,"publisher":"PublisherA","language":"English","ISBN-10":"1234567890","ISBN-13":"123-1234567890"}',
              namespace: "book",
              podName: "details-v1-7dcb9897f-pnxxc",
            },
          },
        ],
      },
    ]);
  });

  it("converts realtime data to history data", () => {
    const historyData = DataTransformer.RealtimeDataToHistoryData(
      realtimeData,
      serviceDependency
    );
    expect(historyData[0].services).toHaveLength(6);
  });
});

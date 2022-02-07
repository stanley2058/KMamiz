import { Trace } from "../src/classes/Trace";
import { EnvoyLogs } from "../src/classes/EnvoyLog";
import { RealtimeData } from "../src/classes/RealtimeData";
import IServiceDependency from "../src/entities/IServiceDependency";

import { MockEndpointDependencies, MockLogs, MockTrace } from "./MockData";
import { EndpointDependencies } from "../src/classes/EndpointDependency";

describe("DataTransformer", () => {
  let endpointDependencies: EndpointDependencies;
  let realtimeData: RealtimeData;
  let serviceDependency: IServiceDependency[];

  it("converts traces to endpoint dependencies", () => {
    endpointDependencies = new Trace(MockTrace).toEndpointDependencies();
    expect(endpointDependencies.dependencies).toHaveLength(6);
    expect(endpointDependencies.dependencies).toContainEqual(
      MockEndpointDependencies[0]
    );
  });

  it("converts endpoint dependencies to graph data", () => {
    const graphData = endpointDependencies.toGraphData();
    expect(graphData.nodes).toHaveLength(11);
    expect(graphData.links).toHaveLength(13);
  });

  it("converts traces to realtime data", () => {
    realtimeData = new Trace(MockTrace).toRealTimeData();
    expect(realtimeData.realtimeData).toHaveLength(MockTrace.flat().length / 2);
  });

  it("converts endpoint dependencies to service dependencies", () => {
    serviceDependency = endpointDependencies.toServiceDependencies();
    expect(serviceDependency).toHaveLength(
      endpointDependencies.dependencies.length
    );
  });

  it("converts trace to endpoint info", () => {
    const info = Trace.ToEndpointInfo(MockTrace[0][0]);
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
    const structuredEnvoyLogs = new EnvoyLogs(MockLogs).toStructured();
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
    const historyData = realtimeData.toHistoryData(serviceDependency);
    expect(historyData[0].services).toHaveLength(6);
  });
});

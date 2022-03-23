import { TCombinedRealtimeData } from "../src/entities/TCombinedRealtimeData";
import { TReplicaCount } from "../src/entities/TReplicaCount";
import CombinedRealtimeDataList from "../src/classes/CombinedRealtimeDataList";
import Utils from "../src/utils/Utils";
import { TServiceDependency } from "../src/entities/TServiceDependency";
import { TEndpointDataType } from "../src/entities/TEndpointDataType";
import { TRealtimeData } from "../src/entities/TRealtimeData";

describe("CombinedRealtimeDataList", () => {
  const service = "srv";
  const namespace = "ns";
  const version = "latest";
  const uniqueServiceName = `${service}\t${namespace}\t${version}`;
  const uniqueEndpointName = `${uniqueServiceName}\tGET\thttp://srv/api/a`;
  const method = "GET";
  const status = "200";
  const today = Date.now();
  const yesterday = Date.now() - 86400000;

  const baseRlData1: TRealtimeData[] = [
    {
      uniqueServiceName,
      uniqueEndpointName,
      service,
      namespace,
      version,
      method,
      status,
      latency: 100,
      timestamp: yesterday * 1000,
      replica: 1,
      requestBody: JSON.stringify({ name: "test request" }),
      requestContentType: "application/json",
      responseBody: JSON.stringify({ name: "test response" }),
      responseContentType: "application/json",
    },
  ];
  const baseData1: TCombinedRealtimeData[] = [
    {
      service,
      namespace,
      version,
      latestTimestamp: yesterday * 1000,
      combined: 10,
      latencies: [100, 120, 80, 100, 120, 80, 120, 80, 120, 80],
      avgLatency: 100,
      method,
      status,
      uniqueServiceName,
      uniqueEndpointName,
      avgReplica: 1,
      requestBody: { name: "test request" },
      requestContentType: "application/json",
      requestSchema: Utils.ObjectToInterfaceString({ name: "string" }),
      responseBody: { name: "test response" },
      responseContentType: "application/json",
      responseSchema: Utils.ObjectToInterfaceString({ name: "string" }),
    },
  ];
  const baseData2: TCombinedRealtimeData[] = [
    {
      service,
      namespace,
      version,
      latestTimestamp: today * 1000,
      combined: 10,
      latencies: [150, 170, 130, 130, 170, 150, 120, 180, 120, 180],
      avgLatency: 150,
      method,
      status,
      uniqueServiceName,
      uniqueEndpointName,
      avgReplica: 1,
      requestBody: { name: "test request" },
      requestContentType: "application/json",
      requestSchema: Utils.ObjectToInterfaceString({ name: "string" }),
      responseBody: { name: "test response" },
      responseContentType: "application/json",
      responseSchema: Utils.ObjectToInterfaceString({ name: "string" }),
    },
  ];
  const combinedBaseData: TCombinedRealtimeData[] = [
    {
      uniqueEndpointName,
      uniqueServiceName,
      service,
      namespace,
      version,
      method,
      status,
      combined: 20,
      requestContentType: "application/json",
      responseContentType: "application/json",
      avgLatency: 125,
      latestTimestamp: today * 1000,
      requestBody: { name: "test request" },
      requestSchema: Utils.ObjectToInterfaceString({ name: "string" }),
      responseBody: { name: "test response" },
      responseSchema: Utils.ObjectToInterfaceString({ name: "string" }),
      latencies: [
        100, 120, 80, 100, 120, 80, 120, 80, 120, 80, 150, 170, 130, 130, 170,
        150, 120, 180, 120, 180,
      ],
    },
  ];
  const replicas: TReplicaCount[] = [
    {
      service,
      namespace,
      version,
      uniqueServiceName,
      replicas: 1,
    },
  ];
  const dependencies: TServiceDependency[] = [
    {
      service,
      namespace,
      version,
      uniqueServiceName,
      dependency: [],
      links: [],
    },
  ];
  const historyData = [
    {
      date: new Date(Utils.BelongsToDateTimestamp(Date.now() - 86400000)),
      services: [
        {
          date: new Date(Utils.BelongsToDateTimestamp(Date.now() - 86400000)),
          endpoints: [
            {
              latencyCV: 0.17888543819998318,
              method,
              requestErrors: 0,
              requests: 10,
              serverErrors: 0,
              uniqueEndpointName,
              uniqueServiceName,
            },
          ],
          service,
          namespace,
          version,
          requests: 10,
          requestErrors: 0,
          serverErrors: 0,
          latencyCV: 0.17888543819998318,
          uniqueServiceName,
          risk: 0.1,
        },
      ],
    },
  ];
  const aggregateData = {
    fromDate: new Date(Utils.BelongsToDateTimestamp(yesterday)),
    toDate: new Date(Utils.BelongsToDateTimestamp(yesterday)),
    services: [
      {
        uniqueServiceName,
        service,
        namespace,
        version,
        totalRequests: 10,
        totalServerErrors: 0,
        totalRequestErrors: 0,
        avgRisk: 0.1,
        avgLatencyCV: 0.17888543819998318,
        endpoints: [
          {
            uniqueServiceName,
            uniqueEndpointName,
            method,
            totalRequests: 10,
            totalServerErrors: 0,
            totalRequestErrors: 0,
            avgLatencyCV: 0.17888543819998318,
          },
        ],
      },
    ],
  };

  const endpointDataType: TEndpointDataType[] = [
    {
      service,
      namespace,
      version,
      method,
      uniqueServiceName,
      uniqueEndpointName,
      schemas: [
        {
          status: "200",
          time: new Date(yesterday),
          requestContentType: "application/json",
          responseContentType: "application/json",
          requestSample: { name: "test request" },
          responseSample: { name: "test response" },
          requestSchema: Utils.ObjectToInterfaceString({ name: "string" }),
          responseSchema: Utils.ObjectToInterfaceString({ name: "string" }),
        },
      ],
    },
  ];

  it("converts to HistoryData", () => {
    const data = new CombinedRealtimeDataList(baseData1);
    const h = data.toHistoryData(dependencies, replicas);
    expect(h).toEqual(historyData);
  });

  it("converts to AggregateData and HistoryData", () => {
    const data = new CombinedRealtimeDataList(baseData1);
    const { aggregateData: a, historyData: h } =
      data.toAggregatedDataAndHistoryData(dependencies, replicas);

    expect(h).toEqual(historyData);
    expect(a).toEqual(aggregateData);
  });

  it("extracts EndpointDataType", () => {
    const data = new CombinedRealtimeDataList(baseData1);
    const dataType = data.extractEndpointDataType().map((d) => d.toJSON());
    expect(dataType).toEqual(endpointDataType);
  });

  it("converts back into RealtimeData", () => {
    const data = new CombinedRealtimeDataList(baseData1);
    const rlData = data.toRealtimeDataForm();
    expect(rlData).toEqual(baseRlData1);
  });

  it("combines with another list", () => {
    const data1 = new CombinedRealtimeDataList(baseData1);
    const data2 = new CombinedRealtimeDataList(baseData2);

    const combined = data1.combineWith(data2);
    expect(combined.toJSON()).toEqual(combinedBaseData);
  });

  it("provides containing namespaces", () => {
    const data = new CombinedRealtimeDataList(baseData1);
    expect([...data.getContainingNamespaces()]).toEqual([namespace]);
  });
});

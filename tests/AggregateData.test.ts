import { AggregateData } from "../src/classes/AggregateData";
import { TAggregateData } from "../src/entities/TAggregateData";

describe("AggregateData", () => {
  const agg1: TAggregateData = {
    fromDate: new Date(),
    toDate: new Date(),
    services: [
      {
        service: "srv",
        namespace: "ns",
        version: "latest",
        avgLatencyCV: 1,
        avgRisk: 0.5,
        totalRequests: 1000,
        totalRequestErrors: 10,
        totalServerErrors: 1,
        uniqueServiceName: "srv\tns\tlatest",
        endpoints: [
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/a",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 500,
            totalRequestErrors: 5,
            totalServerErrors: 1,
            labelName: "/srv/api/a",
          },
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/b",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 500,
            totalRequestErrors: 5,
            totalServerErrors: 0,
            labelName: "/srv/api/b",
          },
        ],
      },
    ],
  };
  const agg2: TAggregateData = {
    fromDate: new Date(),
    toDate: new Date(),
    services: [
      {
        service: "srv",
        namespace: "ns",
        version: "latest",
        avgLatencyCV: 1,
        avgRisk: 0.5,
        totalRequests: 1000,
        totalRequestErrors: 10,
        totalServerErrors: 1,
        uniqueServiceName: "srv\tns\tlatest",
        endpoints: [
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/a",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 500,
            totalRequestErrors: 5,
            totalServerErrors: 1,
            labelName: "/srv/api/a",
          },
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/b",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 500,
            totalRequestErrors: 5,
            totalServerErrors: 0,
            labelName: "/srv/api/b",
          },
        ],
      },
    ],
  };

  const merged: TAggregateData = {
    fromDate: new Date(),
    toDate: new Date(),
    services: [
      {
        service: "srv",
        namespace: "ns",
        version: "latest",
        avgLatencyCV: 1,
        avgRisk: 0.5,
        totalRequests: 2000,
        totalRequestErrors: 20,
        totalServerErrors: 2,
        uniqueServiceName: "srv\tns\tlatest",
        endpoints: [
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/a",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 1000,
            totalRequestErrors: 10,
            totalServerErrors: 2,
            labelName: "/srv/api/a",
          },
          {
            uniqueServiceName: "srv\tns\tlatest",
            uniqueEndpointName: "srv\tns\tlatest\tGET\thttp://srv/api/b",
            avgLatencyCV: 1,
            method: "GET",
            totalRequests: 1000,
            totalRequestErrors: 10,
            totalServerErrors: 0,
            labelName: "/srv/api/b",
          },
        ],
      },
    ],
  };

  it("merges with another AggregateData", () => {
    const m = new AggregateData(agg1).combine(agg2);
    expect(m.toJSON()).toEqual(merged);
  });
});

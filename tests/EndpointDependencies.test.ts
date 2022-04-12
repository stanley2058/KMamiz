import { EndpointDependencies } from "../src/classes/EndpointDependencies";
import { TEndpointDependency } from "../src/entities/TEndpointDependency";
import { MockEndpointDependenciesPDAS } from "./MockData";

describe("EndpointDependencies", () => {
  const dependencies = new EndpointDependencies(
    MockEndpointDependenciesPDAS as TEndpointDependency[]
  );

  it("converts to graph data", () => {
    const { nodes, links } = dependencies.toGraphData();
    expect(nodes.length).toEqual(7);
    expect(links.length).toEqual(6);
  });
  it("converts to chord data", () => {
    expect(dependencies.toChordData()).toEqual({
      nodes: [
        {
          id: "external-service.pdas (latest)",
          name: "external-service\tpdas\tlatest",
        },
        {
          id: "user-service.pdas (latest)",
          name: "user-service\tpdas\tlatest",
        },
        {
          id: "contract-service.pdas (latest)",
          name: "contract-service\tpdas\tlatest",
        },
      ],
      links: [
        {
          from: "external-service.pdas (latest)",
          to: "user-service.pdas (latest)",
          value: 1,
        },
        {
          from: "external-service.pdas (latest)",
          to: "contract-service.pdas (latest)",
          value: 1,
        },
      ],
    });
  });
  it("converts to service dependencies", () => {
    expect(dependencies.toServiceDependencies().length).toEqual(3);
  });
  it("converts to service endpoint cohesion", () => {
    expect(dependencies.toServiceEndpointCohesion()).toEqual([
      {
        uniqueServiceName: "user-service\tpdas\tlatest",
        totalEndpoints: 2,
        consumers: [
          {
            uniqueServiceName: "external-service\tpdas\tlatest",
            consumes: 1,
          },
        ],
        endpointUsageCohesion: 0.5,
      },
      {
        uniqueServiceName: "contract-service\tpdas\tlatest",
        totalEndpoints: 1,
        consumers: [
          {
            uniqueServiceName: "external-service\tpdas\tlatest",
            consumes: 1,
          },
        ],
        endpointUsageCohesion: 1,
      },
      {
        uniqueServiceName: "external-service\tpdas\tlatest",
        totalEndpoints: 1,
        consumers: [],
        endpointUsageCohesion: 0,
      },
    ]);
  });
  it("converts to service coupling", () => {
    expect(dependencies.toServiceCoupling()).toEqual([
      {
        uniqueServiceName: "user-service\tpdas\tlatest",
        name: "user-service.pdas (latest)",
        ais: 1,
        ads: 0,
        acs: 0,
      },
      {
        uniqueServiceName: "contract-service\tpdas\tlatest",
        name: "contract-service.pdas (latest)",
        ais: 1,
        ads: 0,
        acs: 0,
      },
      {
        uniqueServiceName: "external-service\tpdas\tlatest",
        name: "external-service.pdas (latest)",
        ais: 1,
        ads: 2,
        acs: 2,
      },
    ]);
  });
  it("converts to service instability", () => {
    expect(dependencies.toServiceInstability()).toEqual([
      {
        uniqueServiceName: "user-service\tpdas\tlatest",
        name: "user-service.pdas (latest)",
        dependingBy: 1,
        dependingOn: 0,
        instability: 0,
      },
      {
        uniqueServiceName: "contract-service\tpdas\tlatest",
        name: "contract-service.pdas (latest)",
        dependingBy: 1,
        dependingOn: 0,
        instability: 0,
      },
      {
        uniqueServiceName: "external-service\tpdas\tlatest",
        name: "external-service.pdas (latest)",
        dependingBy: 0,
        dependingOn: 2,
        instability: 1,
      },
    ]);
  });
});

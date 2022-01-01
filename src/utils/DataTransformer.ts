import EndpointDependency from "../interfaces/EndpointDependency";
import GraphData from "../interfaces/GraphData";

export default class DataTransformer {
  static EndpointDependenciesToGraphData(
    endpointDependencies: EndpointDependency[]
  ) {
    const initialGraphData: GraphData = {
      nodes: [
        ...endpointDependencies.reduce(
          (prev, e) => prev.add(e.endpoint.serviceName),
          new Set<string>()
        ),
      ].map((e) => ({
        id: e,
        name: e,
        group: e,
      })),
      links: endpointDependencies.map((e) => ({
        source: e.endpoint.serviceName,
        target: `${e.endpoint.version || "NONE"}-${e.endpoint.name}`,
      })),
    };

    return endpointDependencies.reduce((prev, { endpoint, dependencies }) => {
      prev.nodes.push({
        id: `${endpoint.version || "NONE"}-${endpoint.name}`,
        name: `(${endpoint.serviceName} ${endpoint.version}) ${endpoint.path}`,
        group: endpoint.serviceName,
      });

      dependencies.forEach((dependency) => {
        const source = `${endpoint.version || "NONE"}-${endpoint.name}`;
        prev.links = prev.links.concat(
          endpointDependencies
            .filter((e) => e.endpoint.name === dependency.name)
            .map((e) => `${e.endpoint.version || "NONE"}-${e.endpoint.name}`)
            .map((target) => ({ source, target }))
        );
      });
      return prev;
    }, initialGraphData);
  }
}

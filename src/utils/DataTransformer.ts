import EndpointDependency, {
  EndpointInfo,
} from "../interfaces/EndpointDependency";
import GraphData from "../interfaces/GraphData";
import RealtimeData from "../interfaces/RealtimeData";
import Trace from "../interfaces/Trace";
import Utils from "./Utils";

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
            .filter(
              (e) =>
                e.endpoint.name === dependency.endpoint.name &&
                dependency.distance === 1
            )
            .map((e) => `${e.endpoint.version || "NONE"}-${e.endpoint.name}`)
            .map((target) => ({ source, target }))
        );
      });
      return prev;
    }, initialGraphData);
  }

  static TracesToRealTimeData(traces: Trace[][]) {
    return traces
      .flat()
      .filter((t) => t.kind === "SERVER")
      .map((t) => {
        const [host, port, path, serviceName, namespace] = Utils.ExplodeUrl(
          t.name,
          true
        );
        return {
          timestamp: t.timestamp,
          serviceName: `${serviceName}.${namespace}`,
          serviceVersion: t.tags["istio.canonical_revision"],
          protocol: t.tags["http.method"],
          endpointName: `${host}:${port}${path}`,
          latency: t.duration,
          status: t.tags["http.status_code"],
        } as RealtimeData;
      });
  }

  static TracesToEndpointDependencies(traces: Trace[][]) {
    const { endpointInfoMap, endpointDependenciesMap } =
      this.createEndpointInfoAndDependenciesMapFromTrace(traces);

    const endpointDependencies: EndpointDependency[] = [];
    [...endpointInfoMap.entries()].map(([uniqueName, info]) => {
      const dependencies: {
        endpoint: EndpointInfo;
        distance: number;
      }[] = [];
      const stack = [];
      let dependentList = [...(endpointDependenciesMap.get(uniqueName) || [])];
      let depth = 1;
      while (dependentList.length > 0) {
        const depId = dependentList.pop()!;
        const dependency = endpointInfoMap.get(depId);

        const children = endpointDependenciesMap.get(depId);
        if (children) stack.push(...children);

        if (dependency) {
          const exist = !!dependencies.find(
            (e) =>
              e.endpoint.name === dependency.name &&
              e.endpoint.version === dependency.version &&
              e.distance === depth
          );
          if (!exist) {
            dependencies.push({
              endpoint: dependency,
              distance: depth,
            });
          }
        }

        if (dependentList.length === 0) {
          dependentList = stack;
          depth++;
        }
      }
      endpointDependencies.push({
        endpoint: info,
        dependencies,
      });
    });
    return endpointDependencies;
  }
  private static createEndpointInfoAndDependenciesMapFromTrace(
    traces: Trace[][]
  ) {
    const endpointInfoMap = new Map<string, EndpointInfo>();
    const endpointDependenciesMap = new Map<string, Set<string>>();
    traces.forEach((trace) => {
      const endpointMap: {
        [id: string]: {
          info: EndpointInfo;
          trace: Trace;
          parent: string;
          child: Set<string>;
        };
      } = {};
      trace.forEach((span) => {
        const info = DataTransformer.TraceToEndpointInfo(span);
        endpointMap[span.id] = {
          info,
          trace: span,
          parent: span.parentId || "",
          child: new Set<string>(),
        };
        const uniqueName = `${info.version}\t${info.name}`;
        if (!endpointDependenciesMap.has(uniqueName))
          endpointDependenciesMap.set(uniqueName, new Set<string>());
      });
      Object.entries(endpointMap)
        .filter(([, { trace }]) => trace.kind === "SERVER")
        .forEach(([, { info, parent }]) => {
          const uniqueName = `${info.version}\t${info.name}`;
          endpointInfoMap.set(uniqueName, info);

          const parentServerId = endpointMap[parent].parent;
          if (parentServerId) {
            const parentUniqueName = `${endpointMap[parentServerId].info.version}\t${endpointMap[parentServerId].info.name}`;
            endpointDependenciesMap.get(parentUniqueName)!.add(uniqueName);
          }
        });
    });
    return { endpointInfoMap, endpointDependenciesMap };
  }

  static TraceToEndpointInfo(trace: Trace) {
    const [host, port, path] = Utils.ExplodeUrl(trace.tags["http.url"]);
    const [, , , serviceName, namespace, clusterName] = Utils.ExplodeUrl(
      trace.name,
      true
    );
    return {
      name: trace.name,
      version: trace.tags["istio.canonical_revision"] || "NONE",
      serviceName,
      namespace,
      host,
      path,
      port,
      clusterName,
    } as EndpointInfo;
  }
}

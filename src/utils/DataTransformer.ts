import EndpointDependency, {
  EndpointInfo,
} from "../interfaces/EndpointDependency";
import EnvoyLog from "../interfaces/EnvoyLog";
import GraphData from "../interfaces/GraphData";
import RealtimeData from "../interfaces/RealtimeData";
import ServiceDependency from "../interfaces/ServiceDependency";
import StructuredEnvoyLog from "../interfaces/StructuredEnvoyLog";
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
        target: `${e.endpoint.version}-${e.endpoint.name}`,
      })),
    };

    return endpointDependencies.reduce((prev, { endpoint, dependencies }) => {
      prev.nodes.push({
        id: `${endpoint.version}-${endpoint.name}`,
        name: `(${endpoint.serviceName} ${endpoint.version}) ${endpoint.path}`,
        group: endpoint.serviceName,
      });

      dependencies.forEach((dependency) => {
        const source = `${endpoint.version}-${endpoint.name}`;
        prev.links = prev.links.concat(
          endpointDependencies
            .filter(
              (e) =>
                e.endpoint.name === dependency.endpoint.name &&
                dependency.distance === 1
            )
            .map((e) => `${e.endpoint.version}-${e.endpoint.name}`)
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

    // create endpoint dependencies from endpoint mapping and dependencies mapping
    const endpointDependencies: EndpointDependency[] = [];
    [...endpointInfoMap.entries()].map(([uniqueName, info]) => {
      const dependencies: {
        endpoint: EndpointInfo;
        distance: number;
      }[] = [];
      /**
       * algorithm description:
       * 1. pop the an endpoint from the dependencyList, add it to the dependencies
       * 2. add all of its children to the queue
       * 3. if the dependencyList is empty, increase the distance by 1,
       *    assign queue to dependentList, clear the queue and repeat step 1
       */
      let queue = [];
      let dependentList = [...(endpointDependenciesMap.get(uniqueName) || [])];
      let depth = 1;
      while (dependentList.length > 0) {
        const depId = dependentList.pop()!;
        const dependency = endpointInfoMap.get(depId);

        const children = endpointDependenciesMap.get(depId);
        if (children) queue.push(...children);

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
          dependentList = [...queue];
          queue = [];
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
      // create endpoint mapping id -> endpoint
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
      // use only SERVER node, child then register itself to parent
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

  static EndpointDependenciesToServiceDependencies(
    endpointDependencies: EndpointDependency[]
  ) {
    // gather all service info from endpointDependencies
    const serviceTemplates = [
      ...endpointDependencies.reduce(
        (prev, { endpoint }) =>
          prev.add(
            `${endpoint.serviceName}\t${endpoint.namespace}\t${endpoint.version}`
          ),
        new Set<string>()
      ),
    ].map((s) => {
      // map service info to an unique name for easy comparison
      const [service, namespace, version] = s.split("\t");
      return {
        uniqueName: `${service}\t${namespace}\t${version}`,
      };
    });

    // create service dependencies
    return serviceTemplates.map(({ uniqueName }) => {
      // find dependencies for the current service
      const dependency = endpointDependencies.filter(
        ({ endpoint }) =>
          `${endpoint.serviceName}\t${endpoint.namespace}\t${endpoint.version}` ===
          uniqueName
      );

      // create links info from endpointDependencies
      const linkMap = dependency
        .map((dep) => dep.dependencies)
        .flat()
        .map((dep) => {
          const { serviceName, namespace, version } = dep.endpoint;
          return {
            uniqueName: `${serviceName}\t${namespace}\t${version}`,
            distance: dep.distance,
          };
        })
        .reduce((prev, { uniqueName, distance }) => {
          if (!prev[uniqueName]) prev[uniqueName] = { distance, count: 1 };
          else prev[uniqueName].count++;
          return prev;
        }, {} as { [uniqueName: string]: { distance: number; count: number } });

      // combine all previous data to create a service dependency
      const [service, namespace, version] = uniqueName.split("\t");
      return {
        service,
        namespace,
        version,
        dependency,
        links: Object.entries(linkMap).map(
          ([uniqueName, { distance, count }]) => {
            const [service, namespace, version] = uniqueName.split("\t");
            return {
              service,
              namespace,
              version,
              distance,
              count,
            };
          }
        ),
      } as ServiceDependency;
    });
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

  static EnvoyLogsToStructureEnvoyLogs(logs: EnvoyLog[]) {
    const logsMap = new Map<string, EnvoyLog[]>();
    let currentRequestId = logs[0].requestId;
    let entropy = 0;
    let currentLogStack = [];
    for (const log of logs) {
      if (log.requestId !== "NO_ID" && currentRequestId !== log.requestId) {
        if (entropy === 0) logsMap.set(currentRequestId, currentLogStack);
        currentLogStack = [];
        currentRequestId = log.requestId;
      }
      if (log.type === "Request") entropy++;
      if (log.type === "Response") entropy--;
      currentLogStack.push(log);
    }

    const structuredEnvoyLogs: StructuredEnvoyLog[] = [];
    for (const [requestId, logs] of logsMap.entries()) {
      const traces: {
        traceId: string;
        request: EnvoyLog;
        response: EnvoyLog;
      }[] = [];

      const traceStack = [];
      for (const log of logs) {
        if (log.type === "Request") traceStack.push(log);
        if (log.type === "Response") {
          const req = traceStack.pop();
          if (!req) throw new Error("Mismatch request response in logs");
          traces.push({
            traceId:
              // temporary fix for istio book demo
              req.traceId!.length === 32 ? req.traceId! : `0${req.traceId!}`,
            request: req,
            response: log,
          });
        }
      }

      structuredEnvoyLogs.push({
        requestId,
        traces,
      });
    }

    return structuredEnvoyLogs;
  }
}

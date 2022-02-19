import Utils from "../utils/Utils";
import { EndpointDependencies } from "./EndpointDependency";
import { ITrace } from "../entities/external/ITrace";
import { RealtimeData } from "./RealtimeData";
import {
  IEndpointDependency,
  IEndpointInfo,
} from "../entities/IEndpointDependency";
import {
  IStructuredEnvoyLog,
  IStructuredEnvoyLogTrace,
} from "../entities/IEnvoyLog";
import { IRealtimeData } from "../entities/IRealtimeData";
import Logger from "../utils/Logger";

export class Trace {
  private readonly _traces: ITrace[][];
  constructor(traces: ITrace[][]) {
    this._traces = traces;
  }
  get traces() {
    return this._traces;
  }

  toRealTimeData() {
    const realtimeData = this._traces
      .flat()
      .filter((t) => t.kind === "SERVER")
      .map((t) => {
        const [host, port, path, serviceName, namespace] = Utils.ExplodeUrl(
          t.name,
          true
        );
        return {
          timestamp: t.timestamp,
          service: serviceName,
          namespace,
          version: t.tags["istio.canonical_revision"],
          protocol: t.tags["http.method"],
          endpointName: `${host}:${port}${path}`,
          latency: t.duration,
          status: t.tags["http.status_code"],
        } as IRealtimeData;
      });
    return new RealtimeData(realtimeData);
  }

  combineLogsToRealtimeData(structuredLogs: IStructuredEnvoyLog[]) {
    const traceIdToEnvoyLogsMap = structuredLogs
      .map((log) => log.traces)
      .flat()
      .reduce(
        (prev, curr) =>
          prev.set(curr.traceId, [...(prev.get(curr.traceId) || []), curr]),
        new Map<string, IStructuredEnvoyLogTrace[]>()
      );

    return new RealtimeData(
      this.traces
        .flat()
        .filter((t) => t.kind === "SERVER")
        .map((trace) => {
          const logs = traceIdToEnvoyLogsMap.get(trace.traceId);
          const [host, port, path, service, namespace] = Utils.ExplodeUrl(
            trace.name,
            true
          );
          const endpointName = `${host}${port}${path}`;
          const requestUrl = trace.tags["http.url"].replace(
            /(http|https):\/\//,
            ""
          );
          const protocol = trace.tags["http.method"];
          const status = trace.tags["http.status_code"];
          if (!service) return;
          return {
            timestamp: trace.timestamp,
            service,
            namespace,
            version: trace.tags["istio.canonical_revision"],
            protocol,
            endpointName,
            latency: trace.duration,
            status,
            body: logs?.find(
              (l) =>
                l.request.path === requestUrl &&
                l.request.method === protocol &&
                l.response.status === status
            )?.response.body,
          } as IRealtimeData;
        })
        .filter((data) => !!data) as IRealtimeData[]
    );
  }

  toEndpointDependencies() {
    const { endpointInfoMap, endpointDependenciesMap } =
      this.createEndpointInfoAndDependenciesMap();

    // create endpoint dependencies from endpoint mapping and dependencies mapping
    const endpointDependencies: IEndpointDependency[] = [];
    [...endpointInfoMap.entries()].map(([uniqueName, info]) => {
      const dependencies: {
        endpoint: IEndpointInfo;
        distance: number;
      }[] = [];
      /**
       * algorithm description:
       * 1. pop an endpoint from the dependencyList, add it to the dependencies
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
      // add endpoint info and dependencies to overall endpoint dependencies
      endpointDependencies.push({
        endpoint: info,
        dependsOn: dependencies.map((d) => ({ ...d, type: "SERVER" })),
        // fill dependBy later
        dependBy: [],
      });
    });

    // fill dependBy
    endpointDependencies.forEach((e) => {
      // for every dependency
      e.dependsOn.forEach((d) => {
        const uniqueName = `${d.endpoint.version}\t${d.endpoint.name}`;
        // push self to the dependBy of the dependency
        endpointDependencies
          .find(
            (ep) => `${ep.endpoint.version}\t${ep.endpoint.name}` === uniqueName
          )!
          .dependBy.push({
            endpoint: e.endpoint,
            distance: d.distance,
            type: "CLIENT",
          });
      });
    });
    return new EndpointDependencies(endpointDependencies);
  }

  private createEndpointInfoAndDependenciesMap() {
    // endpointInfoMap: uniqueName -> EndpointInfo
    const endpointInfoMap = new Map<string, IEndpointInfo>();
    // endpointDependenciesMap: uniqueName -> [dependent service uniqueName]
    const endpointDependenciesMap = new Map<string, Set<string>>();
    this._traces.forEach((trace) => {
      const endpointMap: {
        [id: string]: {
          info: IEndpointInfo;
          trace: ITrace;
          parent: string;
          child: Set<string>;
        };
      } = {};
      try {
        // create endpoint mapping id -> endpoint
        trace.forEach((span) => {
          const info = Trace.ToEndpointInfo(span);
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

            if (!endpointMap[parent]) {
              Logger.warn(
                `Parent ID [${parent}] not found, is the sidecar set up incorrect?`
              );
              Logger.verbose("Endpoint map:\n", endpointMap);
              throw new Error(`parent id not found: ${parent}`);
            }

            const parentServerId = endpointMap[parent].parent;
            if (parentServerId) {
              const parentUniqueName = `${endpointMap[parentServerId].info.version}\t${endpointMap[parentServerId].info.name}`;
              endpointDependenciesMap.get(parentUniqueName)!.add(uniqueName);
            }
          });
      } catch (err) {
        // already handled, more logging
        Logger.verbose("Verbose causes:");
        Logger.plain.verbose("", err);
      }
    });
    return { endpointInfoMap, endpointDependenciesMap };
  }

  static ToEndpointInfo(trace: ITrace) {
    const [host, port, path] = Utils.ExplodeUrl(trace.tags["http.url"]);
    let [, , , serviceName, namespace, clusterName] = Utils.ExplodeUrl(
      trace.name,
      true
    );
    if (!trace.name.includes(".svc.")) {
      // probably requesting a static file from istio-ingress, fallback to using istio annotations
      serviceName = trace.tags["istio.canonical_service"];
      namespace = trace.tags["istio.namespace"];
      clusterName = trace.tags["istio.mesh_id"];
    }
    return {
      name: trace.name,
      version: trace.tags["istio.canonical_revision"] || "NONE",
      service: serviceName,
      namespace,
      host,
      path,
      port,
      clusterName,
    } as IEndpointInfo;
  }
}

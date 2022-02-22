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
import { IRequestTypeUpper } from "../entities/IRequestType";
import IReplicaCount from "../entities/IReplicaCount";

export class Trace {
  private readonly _traces: ITrace[][];
  constructor(traces: ITrace[][]) {
    this._traces = traces;
  }
  get traces() {
    return this._traces;
  }

  toRealTimeData(replicas?: IReplicaCount[]) {
    const realtimeData = this._traces
      .flat()
      .filter((t) => t.kind === "SERVER")
      .map((t): IRealtimeData => {
        const [host, port, path, serviceName, namespace] = Utils.ExplodeUrl(
          t.name,
          true
        );
        const version = t.tags["istio.canonical_revision"];
        const method = t.tags["http.method"] as IRequestTypeUpper;
        const uniqueServiceName = `${serviceName}\t${namespace}\t${version}`;
        return {
          timestamp: t.timestamp,
          service: serviceName,
          namespace,
          version,
          method,
          labelName: `${host}${port}${path}`,
          latency: t.duration,
          status: t.tags["http.status_code"],
          uniqueServiceName,
          uniqueEndpointName: `${uniqueServiceName}\t${method}\t${t.tags["http.url"]}`,
          replica: replicas?.find(
            (r) => r.uniqueServiceName === uniqueServiceName
          )?.replicas,
        };
      });
    return new RealtimeData(realtimeData);
  }

  combineLogsToRealtimeData(
    structuredLogs: IStructuredEnvoyLog[],
    replicas?: IReplicaCount[]
  ) {
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
        .map((trace): IRealtimeData | undefined => {
          const logs = traceIdToEnvoyLogsMap.get(trace.traceId);
          const [host, port, path, service, namespace] = Utils.ExplodeUrl(
            trace.name,
            true
          );
          const labelName = `${host}${port}${path}`;
          const requestUrl = trace.tags["http.url"].replace(
            /(http|https):\/\//,
            ""
          );
          const method = trace.tags["http.method"] as IRequestTypeUpper;
          const status = trace.tags["http.status_code"];
          if (!service) return;
          const version = trace.tags["istio.canonical_revision"];
          const uniqueServiceName = `${service}\t${namespace}\t${version}`;
          const log = logs?.find(
            (l) =>
              l.request.path === requestUrl &&
              l.request.method === method &&
              l.response.status === status
          );
          return {
            timestamp: trace.timestamp,
            service,
            namespace,
            version,
            method,
            labelName,
            latency: trace.duration,
            status,
            responseBody: log?.response.body,
            requestBody: log?.request.body,
            uniqueServiceName,
            uniqueEndpointName: `${uniqueServiceName}\t${trace.tags["http.method"]}\t${trace.tags["http.url"]}`,
            replica: replicas?.find(
              (r) => r.uniqueServiceName === uniqueServiceName
            )?.replicas,
          };
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
              e.endpoint.labelName === dependency.labelName &&
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
        const uniqueName = `${d.endpoint.version}\t${d.endpoint.labelName}`;
        // push self to the dependBy of the dependency
        endpointDependencies
          .find(
            (ep) =>
              `${ep.endpoint.version}\t${ep.endpoint.labelName}` === uniqueName
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
          const uniqueName = `${info.version}\t${info.labelName}`;
          if (!endpointDependenciesMap.has(uniqueName))
            endpointDependenciesMap.set(uniqueName, new Set<string>());
        });

        // use only SERVER node, child then register itself to parent
        Object.entries(endpointMap)
          .filter(([, { trace }]) => trace.kind === "SERVER")
          .forEach(([, { info, parent }]) => {
            const uniqueName = `${info.version}\t${info.labelName}`;
            endpointInfoMap.set(uniqueName, info);

            if (!endpointMap[parent]) {
              Logger.verbose(
                `Parent ID [${parent}] not found, is the sidecar set up incorrect?`
              );
              Logger.verbose("Endpoint map:\n", endpointMap);
              throw new Error(`parent id not found: ${parent}`);
            }

            const parentServerId = endpointMap[parent].parent;
            if (parentServerId) {
              const parentUniqueName = `${endpointMap[parentServerId].info.version}\t${endpointMap[parentServerId].info.labelName}`;
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

  static ToEndpointInfo(trace: ITrace): IEndpointInfo {
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
    const version = trace.tags["istio.canonical_revision"] || "NONE";
    const uniqueServiceName = `${serviceName}\t${namespace}\t${version}`;
    return {
      labelName: trace.name,
      version,
      service: serviceName,
      namespace,
      url: trace.tags["http.url"],
      host,
      path,
      port,
      clusterName,
      method: trace.tags["http.method"] as IRequestTypeUpper,
      uniqueServiceName,
      uniqueEndpointName: `${uniqueServiceName}\t${trace.tags["http.method"]}\t${trace.tags["http.url"]}`,
    };
  }
}

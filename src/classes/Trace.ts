import Utils from "../utils/Utils";
import IAggregateData from "../entities/IAggregateData";
import { EndpointDependencies } from "./EndpointDependency";
import { ITrace } from "../entities/ITrace";
import { RealtimeData } from "./RealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import {
  IEndpointDependency,
  IEndpointInfo,
} from "../entities/IEndpointDependency";
import { IStructuredEnvoyLog } from "../entities/IEnvoyLog";
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

  toAggregatedDataAndHistoryData(replicas: IReplicaCount[] = []) {
    const realtimeDataForm = this.toRealTimeData();
    const serviceDependencies =
      this.toEndpointDependencies().toServiceDependencies();

    const historyData = realtimeDataForm.toHistoryData(
      serviceDependencies,
      replicas
    );
    const dates = historyData.map((d) => d.date.getTime()).sort();
    const fromDate = new Date(dates[0]);
    const toDate = new Date(dates[dates.length - 1]);

    const aggregateData = {
      fromDate,
      toDate,
      services: Object.values(
        historyData.reduce(
          (prev, curr) => {
            curr.services.forEach((s) => {
              const uniqueName = `${s.service}\t${s.namespace}\t${s.version}`;
              if (!prev[uniqueName]) {
                prev[uniqueName] = {
                  name: s.service,
                  namespace: s.namespace,
                  version: s.version,
                  totalRequests: 0,
                  totalRequestErrors: 0,
                  totalServerErrors: 0,
                  avgRisk: 0,
                };
              }
              if (s.risk) {
                prev[uniqueName].avgRisk =
                  (prev[uniqueName].avgRisk * prev[uniqueName].totalRequests +
                    s.risk * s.requests) /
                  (prev[uniqueName].totalRequests + s.requests);
              }
              prev[uniqueName].totalRequests += s.requests;
              prev[uniqueName].totalRequestErrors += s.requestErrors;
              prev[uniqueName].totalServerErrors += s.serverErrors;
            });
            return prev;
          },
          {} as {
            [id: string]: {
              name: string;
              namespace: string;
              version: string;
              totalRequests: number;
              totalServerErrors: number;
              totalRequestErrors: number;
              avgRisk: number;
            };
          }
        )
      ),
    } as IAggregateData;
    return { historyData, aggregateData };
  }

  combineLogsToRealtimeData(structuredLogs: IStructuredEnvoyLog[]) {
    const traceMap = this._traces.reduce(
      (prev, curr) => prev.set(curr[0].traceId, curr),
      new Map<string, ITrace[]>()
    );

    const realtimeData = structuredLogs
      .map((log) => log.traces)
      .flat()
      .map((trace) => {
        const traceInfo = traceMap.get(trace.traceId);
        if (!traceInfo) return;
        const span = traceInfo
          .filter((t) => t.kind === "SERVER")
          .find(
            (t) => t.tags["http.url"].split("://")[1] === trace.request.path!
          );
        if (!span) return;

        const [, , , serviceName, namespace] = Utils.ExplodeUrl(
          span.name,
          true
        );

        return {
          timestamp: span.timestamp,
          service: `${serviceName}`,
          namespace: `${namespace}`,
          version: span.tags["istio.canonical_revision"],
          protocol: trace.request.method!,
          endpointName: trace.request.path!,
          latency: span.duration,
          status: trace.response.status!,
          body: trace.response.body,
        } as IRealtimeData;
      })
      .filter((data) => !!data) as IRealtimeData[];
    return new RealtimeData(realtimeData);
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
        // already handled skip here
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

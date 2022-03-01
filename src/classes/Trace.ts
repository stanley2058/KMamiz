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
    const logMap = new Map<string, Map<string, IStructuredEnvoyLogTrace>>();
    structuredLogs.forEach((l) => {
      if (l.traces.length === 0) return;
      const { traceId } = l.traces[0];
      if (!logMap.has(traceId)) logMap.set(traceId, new Map());
      l.traces.forEach((t) => {
        logMap.get(traceId)!.set(t.spanId, t);
      });
    });

    const raw = this.traces
      .flat()
      .filter((t) => t.kind === "SERVER")
      .map((trace): IRealtimeData => {
        const service = trace.tags["istio.canonical_service"];
        const namespace = trace.tags["istio.namespace"];
        const version = trace.tags["istio.canonical_revision"];
        const method = trace.tags["http.method"] as IRequestTypeUpper;
        const status = trace.tags["http.status_code"];
        const uniqueServiceName = `${service}\t${namespace}\t${version}`;

        const log = logMap.get(trace.traceId)?.get(trace.id);
        return {
          timestamp: trace.timestamp,
          service,
          namespace,
          version,
          method,
          latency: trace.duration,
          status,
          responseBody: log?.response.body,
          responseContentType: log?.response.contentType,
          requestBody: log?.request.body,
          requestContentType: log?.request.contentType,
          uniqueServiceName,
          uniqueEndpointName: `${uniqueServiceName}\t${trace.tags["http.method"]}\t${trace.tags["http.url"]}`,
          replica: replicas?.find(
            (r) => r.uniqueServiceName === uniqueServiceName
          )?.replicas,
        };
      });
    return new RealtimeData(raw);
  }

  toEndpointDependencies() {
    const spanDependencyMap = new Map<
      string,
      { span: ITrace; upper: Map<string, number>; lower: Map<string, number> }
    >();
    this._traces.flat().forEach((span) => {
      spanDependencyMap.set(span.id, {
        span,
        upper: new Map(),
        lower: new Map(),
      });
    });

    for (const [spanId, { span, upper }] of [...spanDependencyMap.entries()]) {
      let parentId = span.parentId;
      let depth = 1;
      while (parentId) {
        const parentNode = spanDependencyMap.get(parentId);
        if (!parentNode) break;
        upper.set(parentId, depth);
        parentNode.lower.set(spanId, depth);
        parentId = parentNode.span.parentId;
        depth++;
      }
    }

    const dependencies = [...spanDependencyMap.values()].map(
      ({ span, upper, lower }): IEndpointDependency => {
        const upperMap = new Map<string, IEndpointInfo>();
        [...upper.entries()].map(([s, distance]) => {
          const endpoint = Trace.ToEndpointInfo(spanDependencyMap.get(s)!.span);
          upperMap.set(`${endpoint.uniqueEndpointName}\t${distance}`, endpoint);
        });
        const lowerMap = new Map<string, IEndpointInfo>();
        [...lower.entries()].map(([s, distance]) => {
          const endpoint = Trace.ToEndpointInfo(spanDependencyMap.get(s)!.span);
          lowerMap.set(`${endpoint.uniqueEndpointName}\t${distance}`, endpoint);
        });

        const dependBy = [...upperMap.entries()].map(([id, endpoint]) => {
          const token = id.split("\t");
          const distance = parseInt(token[token.length - 1]);
          return {
            endpoint,
            distance,
            type: "CLIENT" as "CLIENT",
          };
        });

        const dependsOn = [...lowerMap.entries()].map(([id, endpoint]) => {
          const token = id.split("\t");
          const distance = parseInt(token[token.length - 1]);
          return {
            endpoint,
            distance,
            type: "SERVER" as "SERVER",
          };
        });

        return {
          endpoint: Trace.ToEndpointInfo(span),
          dependBy,
          dependsOn,
        };
      }
    );
    return new EndpointDependencies(dependencies);
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
      version,
      service: serviceName,
      namespace,
      url: trace.tags["http.url"],
      host,
      path,
      port: port || "80",
      clusterName,
      method: trace.tags["http.method"] as IRequestTypeUpper,
      uniqueServiceName,
      uniqueEndpointName: `${uniqueServiceName}\t${trace.tags["http.method"]}\t${trace.tags["http.url"]}`,
    };
  }
}

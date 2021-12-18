import { Axios } from "axios";
import { group } from "console";
import { stringify } from "querystring";
import EndpointDependency from "../interfaces/EndpointDependency";
import GraphData from "../interfaces/GraphData";
import Trace from "../interfaces/Trace";

export default class ZipkinService {
  private static instance?: ZipkinService;
  static getInstance = () => this.instance || (this.instance = new this());

  private zipkinHost: string;
  private zipkinClient: Axios;
  private constructor() {
    this.zipkinHost = process.env.ZIPKIN_URL!;
    this.zipkinClient = new Axios({
      baseURL: `${this.zipkinHost}/zipkin/api/v2`,
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });

    if (!this.zipkinHost) throw new Error("Variable [ZIPKIN_URL] not set");
  }

  async getTraceListFromZipkinByServiceName(serviceName: string, time: number) {
    const response = await this.zipkinClient.get<Trace[][]>(
      `/traces?serviceName=${serviceName}&endTs=${time}&lookback=86400000&limit=1000`
    );
    return response.data;
  }

  async getServicesFromZipkin() {
    const { data } = await this.zipkinClient.get<string[]>("/services");
    return data;
  }

  retrieveEndpointDependenciesFromZipkin(
    traces: Trace[][]
  ): EndpointDependency[] {
    const endpointMapping = new Map<string, Set<string>>();
    traces.forEach((singleTrace) => {
      const result = this.constructEndpointDependenciesFromTrace(singleTrace);
      result.forEach((dependencies, endpoint) => {
        if (!endpointMapping.has(endpoint)) {
          endpointMapping.set(endpoint, dependencies);
        } else {
          // merge dependencies
          endpointMapping.set(
            endpoint,
            new Set([...(endpointMapping.get(endpoint) || []), ...dependencies])
          );
        }
      });
    });

    // map endpointMapping to result
    const result = [...endpointMapping].map(([endpoint, dependencies]) => {
      const [name, version, serviceName] = endpoint.split("\t");
      const splitPoint = name.indexOf("/");
      const host = name.substring(0, splitPoint);
      const path = name.substring(splitPoint);
      const port = host.substring(host.lastIndexOf(":") + 1);
      const clusterName = host
        .replace(`:${port}`, "")
        .replace(`${serviceName}.svc.`, "");
      return {
        endpoint: { name, version, serviceName, host, path, port, clusterName },
        dependencies: [...dependencies],
      };
    });

    return result.map(({ endpoint, dependencies }) => {
      return {
        endpoint,
        dependencies: dependencies.map((d) => {
          const foundEndpoint = result.find(
            (e) => e.endpoint.name === d
          )?.endpoint;
          if (!foundEndpoint) throw new Error("Mismatched endpoint");
          const { name, serviceName, host, path, port, clusterName } =
            foundEndpoint;
          return { name, serviceName, host, path, port, clusterName };
        }),
      };
    });
  }

  constructEndpointDependenciesFromTrace(trace: Trace[]) {
    const endpointMapping = new Map<string, Set<string>>();
    const root = trace.find((t) => !t.parentId);
    if (!root) throw new Error("No root trace found");

    trace
      .filter((t) => t.kind === "SERVER")
      .forEach((t) => {
        const key = `${t.name}\t${
          t.tags["istio.canonical_revision"] || "NONE"
        }\t${t.localEndpoint.serviceName}`;
        endpointMapping.set(key, new Set());
      });

    let currentTrace: Trace = root;
    const queue: Trace[] = [];
    while (true) {
      trace.forEach((link) => {
        if (link.parentId !== currentTrace.id) return;
        // push all children to queue
        queue.push(link);

        // if is an outbound link, add to mapping
        const { name, tags } = link;
        const version = tags["istio.canonical_revision"] || "NONE";
        const key = `${currentTrace.name}\t${version}\t${currentTrace.localEndpoint.serviceName}`;
        if (currentTrace.kind === "SERVER") {
          if (!endpointMapping.has(currentTrace.name))
            endpointMapping.set(key, new Set());
          endpointMapping.get(key)?.add(name);
        }
      });

      // pop one from queue
      if (queue.length === 0) break;
      currentTrace = queue.pop()!;
    }

    return endpointMapping;
  }

  transformEndpointDependenciesToGraphData(
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

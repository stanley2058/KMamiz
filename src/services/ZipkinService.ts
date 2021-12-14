import { Axios } from "axios";
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

  retrieveEndpointDependenciesFromZipkin(traces: Trace[][]) {
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
    return [...endpointMapping].map(([endpoint, dependencies]) => {
      const [name, version] = endpoint.split("\t");
      return {
        endpoint: { name, version },
        dependencies: [...dependencies],
      };
    });
  }

  constructEndpointDependenciesFromTrace(trace: Trace[]) {
    const endpointMapping = new Map<string, Set<string>>();
    const root = trace.find((t) => !t.parentId);
    if (!root) throw new Error("No root trace found");

    let currentTrace: Trace = root;
    const queue: Trace[] = [];
    while (true) {
      trace.forEach((link) => {
        if (link.parentId !== currentTrace.id) return;
        // push all children to queue
        queue.push(link);

        // if is an outbound link, add to mapping
        if (currentTrace.kind === "SERVER") {
          const { name, tags } = link;
          const version = tags["istio.canonical_revision"] || "NONE";
          const key = `${currentTrace.name}\t${version}`;
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
}

import { Axios } from "axios";
import EndpointDependency from "../interfaces/EndpointDependency";
import Trace from "../interfaces/Trace";

export default class ZipkinService {
  private static instance?: ZipkinService;
  static getInstance = () => this.instance || (this.instance = new this());

  private DEFAULT_LOOKBACK = 86400000 * 7; // 1 week

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

  async getTraceListFromZipkinByServiceName(
    lookBack: number = this.DEFAULT_LOOKBACK,
    endTs: number = Date.now(),
    serviceName: string = "istio-ingressgateway.istio-system"
  ) {
    const response = await this.zipkinClient.get<Trace[][]>(
      `/traces?serviceName=${serviceName}&endTs=${endTs}&lookback=${lookBack}&limit=100000`
    );
    return response.data;
  }

  async getServicesFromZipkin() {
    const { data } = await this.zipkinClient.get<string[]>("/services");
    return data;
  }

  async getEndpointDependencies(
    lookBack: number = this.DEFAULT_LOOKBACK,
    endTs: number = Date.now(),
    serviceName: string = "istio-ingressgateway.istio-system"
  ) {
    return this.retrieveEndpointDependenciesFromZipkin(
      await this.getTraceListFromZipkinByServiceName(
        lookBack,
        endTs,
        serviceName
      )
    );
  }

  private retrieveEndpointDependenciesFromZipkin(
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

  private constructEndpointDependenciesFromTrace(trace: Trace[]) {
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

  async createAggregatedAndHistoryData() {
    const today = new Date(new Date().toLocaleDateString());
    // start from a week ago, and look back a month
    const endTs = new Date(today.getTime() - 86400000 * 7).getTime();
    const lookBack = 86400000 * 30;

    const services = await this.getServicesFromZipkin();
    const traces = services
      .map((s) => this.getTraceListFromZipkinByServiceName(lookBack, endTs))
      .map(async (traceList) => await traceList);
  }
}

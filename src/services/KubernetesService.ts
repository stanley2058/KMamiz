import { Axios, AxiosRequestConfig } from "axios";
import GlobalSettings from "../GlobalSettings";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { PodList } from "../entities/external/PodList";
import { TReplicaCount } from "../entities/TReplicaCount";
import { ServiceList } from "../entities/external/ServiceList";
import { TEnvoyLog } from "../entities/TEnvoyLog";
import Utils from "../utils/Utils";
import Logger from "../utils/Logger";
import { TRequestTypeUpper } from "../entities/TRequestType";
import { readFileSync } from "fs";
import { Agent } from "https";

export default class KubernetesService {
  private static instance?: KubernetesService;
  static getInstance = () => this.instance || (this.instance = new this());

  private DEFAULT_LOG_LIMIT = 10000;

  private readonly serviceAccount =
    "/var/run/secrets/kubernetes.io/serviceaccount";
  private kubeApiHost: string;
  private logClient!: Axios;
  private currentNamespace: string = "";
  private constructor() {
    const config: AxiosRequestConfig<any> = {};
    if (GlobalSettings.IsRunningInKubernetes) {
      try {
        const token = readFileSync(`${this.serviceAccount}/token`).toString();
        if (!token) throw new Error("token is empty");
        config.headers = {
          Authorization: `Bearer ${token}`,
        };
        config.httpsAgent = new Agent({
          ca: readFileSync(`${this.serviceAccount}/ca.crt`),
        });

        this.currentNamespace = readFileSync(
          `${this.serviceAccount}/namespace`
        ).toString();
      } catch (err) {
        Logger.fatal(
          "Cannot retrieve authorization token for Kubernetes API server.",
          err
        );
      }
    }
    this.kubeApiHost = GlobalSettings.KubeApiHost;
    if (!this.kubeApiHost) Logger.fatal("Variable [KUBE_API_HOST] not set");
    config.baseURL = `${this.kubeApiHost}/api/v1`;
    this.logClient = new Axios(config);
  }

  private async mustSuccessRequest<Type>(
    method: "get" | "post" | "delete" | "put" | "head" | "patch" | "options",
    path: string,
    config?: AxiosRequestConfig<any>
  ) {
    const response = await Utils.AxiosRequest<Type>(
      this.logClient,
      method,
      path,
      config
    );
    if (!response) {
      Logger.fatal(
        "Cannot retrieve necessary data from Kubernetes API server."
      );
    }
    return response!.data;
  }

  async getPodList(namespace: string) {
    return await this.mustSuccessRequest<PodList>(
      "get",
      `/namespaces/${namespace}/pods`,
      {
        responseType: "json",
        transformResponse: (data) => JSON.parse(data),
      }
    );
  }

  async getServiceList(namespace: string) {
    return await this.mustSuccessRequest<ServiceList>(
      "get",
      `/namespaces/${namespace}/services`,
      {
        responseType: "json",
        transformResponse: (data) => JSON.parse(data),
      }
    );
  }

  async getReplicasFromPodList(namespace: string) {
    const pods = await this.getPodList(namespace);
    const replicaMap = pods.items
      .map((p) => {
        const service = p.metadata.labels["service.istio.io/canonical-name"];
        const namespace = p.metadata.namespace;
        const version =
          p.metadata.labels["service.istio.io/canonical-revision"];
        const uniqueServiceName = `${service}\t${namespace}\t${version}`;
        return { service, namespace, version, uniqueServiceName };
      })
      .reduce((prev, curr) => {
        const existing = prev.get(curr.uniqueServiceName);
        return prev.set(curr.uniqueServiceName, {
          ...curr,
          replicas: (existing?.replicas || 0) + 1,
        });
      }, new Map<string, TReplicaCount>());
    return [...replicaMap.values()];
  }

  async getReplicas(namespaces?: Set<string>) {
    if (!namespaces) namespaces = new Set(await this.getNamespaces());
    let replicas: TReplicaCount[] = [];
    for (const ns of namespaces) {
      replicas = replicas.concat(await this.getReplicasFromPodList(ns));
    }
    return replicas;
  }

  async getPodNames(namespace: string) {
    return (await this.getPodList(namespace)).items.map(
      (pod) => pod.metadata.name
    );
  }

  async getNamespaces() {
    const { data } = await this.logClient.get("/namespaces", {
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });
    return data.items.map(
      (namespace: any) => namespace.metadata.name
    ) as string[];
  }

  async forceKMamizSync() {
    const client = new Axios({
      baseURL: `http://kmamiz.${this.currentNamespace}.svc:${GlobalSettings.ServicePort}`,
    });
    try {
      const syncPath = `/api/v${GlobalSettings.ApiVersion}/data/sync`;
      const res = await client.post(syncPath);
      if (res.status === 200) {
        Logger.verbose("Notified existing instance to sync.");
      }
    } catch (err) {}
  }

  async getEnvoyLogs(
    namespace: string,
    podName: string,
    limit: number = this.DEFAULT_LOG_LIMIT
  ) {
    const data = await this.mustSuccessRequest<string>(
      "get",
      `/namespaces/${namespace}/pods/${podName}/log?container=istio-proxy&tailLines=${limit}`,
      { responseType: "text" }
    );
    const logs = data
      .split("\n")
      .filter(
        (line) => line.includes("script log: ") || line.includes("wasm log ")
      )
      .map((line) =>
        line.replace(
          /\twarning\tenvoy (lua|wasm)\t(script|wasm) log[^:]*: /,
          "\t"
        )
      );
    return KubernetesService.ParseEnvoyLogs(logs, namespace, podName);
  }

  static ParseEnvoyLogs(logs: string[], namespace: string, podName: string) {
    const envoyLogs = logs
      .map((l): TEnvoyLog | null => {
        const [time, log] = l.split("\t");
        const [, type, requestId, traceId, spanId, parentSpanId] =
          log.match(
            /\[(Request|Response) ([\w-_]+)\/([\w_]+)\/([\w_]+)\/([\w_]+)\]/
          ) || [];
        if (traceId === "NO_ID") return null;
        const [, status] = log.match(/\[Status\] ([0-9]+)/) || [];
        const [, method, path] =
          log.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^\]]+)/) || [];
        const [, contentType] = log.match(/\[ContentType\ ([^\]]*)]/) || [];
        const [, body] = log.match(/\[Body\] (.*)/) || [];
        return {
          timestamp: new Date(time),
          type: type as "Request" | "Response",
          requestId,
          traceId,
          spanId,
          parentSpanId,
          method: method as TRequestTypeUpper,
          path,
          status,
          body,
          contentType,
          namespace,
          podName,
        };
      })
      .filter((l) => !!l) as TEnvoyLog[];
    return new EnvoyLogs(envoyLogs);
  }
}

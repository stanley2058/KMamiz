import { Axios, AxiosRequestConfig } from "axios";
import GlobalSettings from "../GlobalSettings";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { IPodList } from "../entities/external/IPodList";
import IReplicaCount from "../entities/IReplicaCount";
import { IServiceList } from "../entities/external/IServiceList";
import { IEnvoyLog } from "../entities/IEnvoyLog";
import Utils from "../utils/Utils";
import Logger from "../utils/Logger";
import { IRequestTypeUpper } from "../entities/IRequestType";
import { readFileSync } from "fs";

export default class KubernetesService {
  private static instance?: KubernetesService;
  static getInstance = () => this.instance || (this.instance = new this());

  private DEFAULT_LOG_LIMIT = 100000;

  private kubeApiHost: string;
  private logClient!: Axios;
  private constructor() {
    const config: AxiosRequestConfig<any> = {};
    if (GlobalSettings.IsRunningInKubernetes) {
      try {
        const token = readFileSync(
          "/var/run/secrets/kubernetes.io/serviceaccount/token"
        ).toString();
        if (!token) throw new Error("token is empty");
        config.headers = {
          Authorization: `Bearer ${token}`,
        };
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
    if (response) return response.data;
    return Logger.fatal(
      "Cannot retrieve necessary data from Kubernetes API server."
    );
  }

  async getPodList(namespace: string) {
    return await this.mustSuccessRequest<IPodList>(
      "get",
      `/namespaces/${namespace}/pods`,
      {
        responseType: "json",
        transformResponse: (data) => JSON.parse(data),
      }
    );
  }

  async getServiceList(namespace: string) {
    return await this.mustSuccessRequest<IServiceList>(
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
    return Object.entries(
      pods.items
        .map(
          (p) =>
            `${p.metadata.labels.app}\t${p.metadata.namespace}\t${p.metadata.labels.version}`
        )
        .reduce((acc, cur) => {
          acc[cur] = (acc[cur] || 0) + 1;
          return acc;
        }, {} as { [id: string]: number })
    ).map(([uniqueServiceName, replicas]): IReplicaCount => {
      const [service, namespace, version] = uniqueServiceName.split("\t");
      return {
        service,
        namespace,
        version,
        replicas,
        uniqueServiceName,
      };
    });
  }

  async getReplicas(namespaces?: Set<string>) {
    if (!namespaces) namespaces = new Set(await this.getNamespaces());
    let replicas: IReplicaCount[] = [];
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
      .filter((line) => line.includes("script log: "))
      .map((line) =>
        line.replace(
          `\t${GlobalSettings.EnvoyLogLevel}\tenvoy lua\tscript log: `,
          "\t"
        )
      );
    return KubernetesService.ParseEnvoyLogs(logs, namespace, podName);
  }

  static ParseEnvoyLogs(logs: string[], namespace: string, podName: string) {
    const envoyLogs = logs
      .map((l): IEnvoyLog | null => {
        const [time, log] = l.split("\t");
        const [, requestRid, traceId, responseRid] =
          log.match(/\[Request ([\w-]+)\/(\w+)|Response ([\w-]+)\]/) || [];
        if (traceId === "NO_ID") return null;
        const [, status] = log.match(/\[Status\] ([0-9]+)/) || [];
        const [, method, path] =
          log.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^\]]+)/) || [];
        const [, body] = log.match(/\[Body\] (.*)/) || [];
        return {
          timestamp: new Date(time),
          type: requestRid ? "Request" : "Response",
          requestId: requestRid || responseRid,
          traceId,
          method: method as IRequestTypeUpper,
          path,
          status,
          body,
          namespace,
          podName,
        };
      })
      .filter((l) => !!l) as IEnvoyLog[];
    return new EnvoyLogs(envoyLogs);
  }
}

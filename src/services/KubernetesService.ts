import { Axios } from "axios";
import GlobalSettings from "../GlobalSettings";
import { EnvoyLogs } from "../classes/EnvoyLog";
import { IPodList } from "../entities/IPodList";
import IReplicaCount from "../entities/IReplicaCount";
import { IServiceList } from "../entities/IServiceList";
import { IEnvoyLog } from "../entities/IEnvoyLog";

export default class KubernetesService {
  private static instance?: KubernetesService;
  static getInstance = () => this.instance || (this.instance = new this());

  private DEFAULT_LOG_LIMIT = 100000;

  private kubeApiHost: string;
  private logClient: Axios;
  private constructor() {
    this.kubeApiHost = GlobalSettings.KubeApiHost;
    this.logClient = new Axios({
      baseURL: `${this.kubeApiHost}/api/v1`,
    });
    if (!this.kubeApiHost) throw new Error("Variable [KUBE_API_HOST] not set");
  }

  async getPodList(namespace: string) {
    const { data } = await this.logClient.get(`/namespaces/${namespace}/pods`, {
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });
    return data as IPodList;
  }

  async getServiceList(namespace: string) {
    const { data } = await this.logClient.get(
      `/namespaces/${namespace}/services`,
      {
        responseType: "json",
        transformResponse: (data) => JSON.parse(data),
      }
    );
    return data as IServiceList;
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
    ).map(([uniqueName, replicas]) => {
      const [service, namespace, version] = uniqueName.split("\t");
      return {
        service,
        namespace,
        version,
        replicas,
      };
    }) as IReplicaCount[];
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
    const { data } = await this.logClient.get<string>(
      `/namespaces/${namespace}/pods/${podName}/log?container=istio-proxy&tailLines=${limit}`,
      {
        responseType: "text",
      }
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
    const envoyLogs = logs.map((l) => {
      const [time, log] = l.split("\t");
      const [, requestRid, traceId, responseRid] =
        log.match(/\[Request ([\w-]+)\/(\w+)|Response ([\w-]+)\]/) || [];
      const [, status] = log.match(/\[Status\] ([0-9]+)/) || [];
      const [, method, path] =
        log.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^\]]+)/) || [];
      const [, body] = log.match(/\[Body\] (.*)/) || [];

      return {
        timestamp: new Date(time),
        type: requestRid ? "Request" : "Response",
        requestId: requestRid || responseRid,
        traceId,
        method,
        path,
        status,
        body,
        namespace,
        podName,
      } as IEnvoyLog;
    });
    return new EnvoyLogs(envoyLogs);
  }
}

import { Axios } from "axios";
import EnvoyLog from "../interfaces/EnvoyLog";
import { PodList } from "../interfaces/PodList";
import { ServiceList } from "../interfaces/ServiceList";

export default class KubernetesService {
  private static instance?: KubernetesService;
  static getInstance = () => this.instance || (this.instance = new this());

  private kubeApiHost: string;
  private logClient: Axios;
  private constructor() {
    this.kubeApiHost = process.env.KUBEAPI_HOST!;
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
    return data as PodList;
  }

  async getServiceList(namespace: string) {
    const { data } = await this.logClient.get(
      `/namespaces/${namespace}/services`,
      {
        responseType: "json",
        transformResponse: (data) => JSON.parse(data),
      }
    );
    return data as ServiceList;
  }

  async getReplicasFromPodList(namespace: string) {
    const pods = await KubernetesService.getInstance().getPodList(namespace);
    const podNameList = pods.items.map((p) => ({
      deploy: p.metadata.name.split(
        `-${p.metadata.labels["pod-template-hash"]}`
      )[0],
      podName: p.metadata.name,
      app: p.metadata.labels.app,
    }));

    return [...new Set(podNameList.map(({ deploy }) => deploy))].map(
      (deploy) => {
        const replicas = podNameList.filter((p) => p.deploy === deploy);
        return {
          deploy,
          pods: replicas.map(({ podName }) => podName),
          app: replicas[0].app,
        };
      }
    );
  }

  async getPodNames(namespace: string) {
    return (
      await KubernetesService.getInstance().getPodList(namespace)
    ).items.map((pod) => pod.metadata.name);
  }

  async getNamespaces() {
    const { data } = await this.logClient.get("/namespaces", {
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });
    return data.items.map((namespace: any) => namespace.metadata.name);
  }

  async getEnvoyLogs(
    namespace: string,
    podName: string,
    limit: number = 10000
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
      .map((line) => line.replace("\twarning	envoy lua\tscript log: ", "\t"));

    return KubernetesService.getInstance().parseEnvoyLogs(
      logs,
      namespace,
      podName
    );
  }

  parseEnvoyLogs(logs: string[], namespace: string, podName: string) {
    return logs.map((l) => {
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
      } as EnvoyLog;
    });
  }
}

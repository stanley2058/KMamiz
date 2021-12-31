import { Axios } from "axios";
import GlobalSettings from "../GlobalSettings";
import EnvoyLog from "../interfaces/EnvoyLog";
import { PodList } from "../interfaces/PodList";
import { ServiceList } from "../interfaces/ServiceList";
import StructuredEnvoyLog from "../interfaces/StructuredEnvoyLog";

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
    limit: number = 100000
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
          `\t${GlobalSettings.envoyLogLevel}\tenvoy lua\tscript log: `,
          "\t"
        )
      );

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

  structureEnvoyLogs(logs: EnvoyLog[]) {
    const logsMap = new Map<string, EnvoyLog[]>();
    let currentRequestId = logs[0].requestId;
    let entropy = 0;
    let currentLogStack = [];
    for (const log of logs) {
      if (log.requestId !== "NO_ID" && currentRequestId !== log.requestId) {
        if (entropy === 0) logsMap.set(currentRequestId, currentLogStack);
        currentLogStack = [];
        currentRequestId = log.requestId;
      }
      if (log.type === "Request") entropy++;
      if (log.type === "Response") entropy--;
      currentLogStack.push(log);
    }

    const structuredEnvoyLogs: StructuredEnvoyLog[] = [];
    for (const [requestId, logs] of logsMap.entries()) {
      const traces: {
        traceId: string;
        request: EnvoyLog;
        response: EnvoyLog;
      }[] = [];

      const traceStack = [];
      for (const log of logs) {
        if (log.type === "Request") traceStack.push(log);
        if (log.type === "Response") {
          const req = traceStack.pop();
          if (!req) throw new Error("Mismatch request response in logs");
          traces.push({
            traceId:
              req.traceId!.length === 32 ? req.traceId! : `0${req.traceId!}`,
            request: req,
            response: log,
          });
        }
      }

      structuredEnvoyLogs.push({
        requestId,
        traces,
      });
    }

    return structuredEnvoyLogs;
  }

  combineStructuredEnvoyLogs(logs: StructuredEnvoyLog[][]) {
    const logMap = new Map<
      string,
      {
        traceId: string;
        request: EnvoyLog;
        response: EnvoyLog;
      }[]
    >();

    logs.forEach((serviceLog) =>
      serviceLog.forEach((log) => {
        logMap.set(log.requestId, [
          ...(logMap.get(log.requestId) || []),
          ...log.traces,
        ]);
      })
    );

    const combinedLogs: StructuredEnvoyLog[] = [];
    for (const [requestId, traces] of logMap.entries()) {
      combinedLogs.push({
        requestId,
        traces: traces.sort((t) => t.request.timestamp.getTime()),
      });
    }
    return combinedLogs;
  }
}

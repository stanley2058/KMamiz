import { Axios } from "axios";

export default class EnvoyLogAnalyzer {
  private static instance?: EnvoyLogAnalyzer;
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
    return data.items.map((pod: any) => pod.metadata.name);
  }

  async getNamespaces() {
    const { data } = await this.logClient.get("/namespaces", {
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });
    return data.items.map((namespace: any) => namespace.metadata.name);
  }

  async getEnvoyLogs(namespace: string, podName: string) {
    const { data } = await this.logClient.get<string>(
      `/namespaces/${namespace}/pods/${podName}//log?container=istio-proxy&tailLines=100`,
      {
        responseType: "text",
      }
    );
    return data
      .split("\n")
      .filter((line) => line.includes("script log: "))
      .map((line) => line.split("script log: ")[1]);
  }
}

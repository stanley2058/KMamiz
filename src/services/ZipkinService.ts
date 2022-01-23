import { Axios } from "axios";
import { ITrace } from "../entities/ITrace";

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
    const response = await this.zipkinClient.get<ITrace[][]>(
      `/traces?serviceName=${serviceName}&endTs=${endTs}&lookback=${lookBack}&limit=100000`
    );
    return response.data;
  }

  async getServicesFromZipkin() {
    const { data } = await this.zipkinClient.get<string[]>("/services");
    return data;
  }
}

import { Axios } from "axios";
import { ITrace } from "../entities/ITrace";
import GlobalSettings from "../GlobalSettings";
import Utils from "../utils/Utils";

export default class ZipkinService {
  private static instance?: ZipkinService;
  static getInstance = () => this.instance || (this.instance = new this());

  private DEFAULT_LOOKBACK = 86400000 * 7; // 1 week

  private zipkinHost: string;
  private zipkinClient: Axios;
  private constructor() {
    this.zipkinHost = GlobalSettings.ZipkinUrl!;
    this.zipkinClient = new Axios({
      baseURL: `${this.zipkinHost}/zipkin/api/v2`,
      responseType: "json",
      transformResponse: (data) => JSON.parse(data),
    });

    if (!this.zipkinHost) throw new Error("Variable [ZIPKIN_URL] not set");
  }

  /**
   * Get trace list from Zipkin by service name
   * @param lookBack looking back for `lookBack` milliseconds
   * @param endTs looking back from timestamp
   * @param serviceName root searching service name
   * @returns traces
   */
  async getTraceListFromZipkinByServiceName(
    lookBack: number = this.DEFAULT_LOOKBACK,
    endTs: number = Date.now(),
    serviceName: string = "istio-ingressgateway.istio-system"
  ) {
    const response = await Utils.AxiosRequest<ITrace[][]>(
      this.zipkinClient,
      "get",
      `/traces?serviceName=${serviceName}&endTs=${endTs}&lookback=${lookBack}&limit=100000`
    );
    if (response) return response.data;
    return [];
  }

  async getServicesFromZipkin() {
    const response = await Utils.AxiosRequest<string[]>(
      this.zipkinClient,
      "get",
      "/services"
    );
    if (response) return response.data;
    return [];
  }
}

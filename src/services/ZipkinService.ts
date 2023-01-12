import { Axios } from "axios";
import { Trace } from "../entities/external/Trace";
import GlobalSettings from "../GlobalSettings";
import Logger from "../utils/Logger";
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
      decompress: true,
      headers: {
        Accept: "application/json",
      },
      transformResponse: (data) => {
        try {
          return JSON.parse(data);
        } catch (err) {
          Logger.error("Error parsing json", data);
          throw err;
        }
      },
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
    limit = 100000,
    serviceName: string = "istio-ingressgateway.istio-system"
  ) {
    const response = await Utils.AxiosRequest<Trace[][]>(
      this.zipkinClient,
      "get",
      `/traces?serviceName=${serviceName}&endTs=${endTs}&lookback=${lookBack}&limit=${limit}`
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

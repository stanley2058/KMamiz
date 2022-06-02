import { CLookBackRealtimeData } from "../classes/Cacheable/CLookBackRealtimeData";
import {
  THistoricalData,
  THistoricalServiceInfo,
} from "../entities/THistoricalData";
import IRequestHandler from "../entities/TRequestHandler";
import { TRiskViolation } from "../entities/TRiskViolation";
import DataCache from "../services/DataCache";
import ServiceUtils from "../services/ServiceUtils";

export default class AlertService extends IRequestHandler {
  private static readonly ALERT_TIMEOUT = 3600000;
  private _lastUpdateTime = 0;
  private _violation: Map<string, TRiskViolation> = new Map();
  constructor() {
    super("alert");
    this.addRoute("get", "/violation/:namespace?", async (req, res) => {
      const notBeforeQuery = req.query["notBefore"] as string;
      const notBefore = notBeforeQuery ? parseInt(notBeforeQuery) : undefined;

      await this.gatherRiskViolations(req.params["namespace"], notBefore);

      const result = [...this._violation.values()].sort(
        (a, b) => b.timeoutAt - a.timeoutAt
      );
      res.json(result);
    });
  }

  private clearTimeoutViolation() {
    const cleared = [...this._violation.entries()].filter(
      ([, v]) => v.timeoutAt > Date.now()
    );
    this._violation = new Map(cleared);
  }

  private async gatherRiskViolations(
    namespace?: string,
    notBefore: number = 86400000
  ) {
    this.clearTimeoutViolation();
    const updateTime = DataCache.getInstance().get<CLookBackRealtimeData>(
      "LookBackRealtimeData"
    ).lastUpdate;
    if (this._lastUpdateTime === updateTime) return;

    const historicalData =
      await ServiceUtils.getInstance().getRealtimeHistoricalData(
        namespace,
        notBefore
      );
    const servicesWithViolation = this.getServicesWithViolation(historicalData);
    const violations = servicesWithViolation.map((s): TRiskViolation => {
      const highlightNodeName =
        this.determineEndpointToHighlight(s) || `${s.service}\t${s.namespace}`;
      const id = `${s.uniqueServiceName}\t${highlightNodeName}`;
      const displayName = `${s.service}.${s.namespace} (${s.version})`;
      return {
        id,
        uniqueServiceName: s.uniqueServiceName,
        displayName,
        occursAt: this._violation.get(id)?.occursAt || Date.now(),
        timeoutAt: Date.now() + AlertService.ALERT_TIMEOUT,
        highlightNodeName,
      };
    });

    violations.forEach((v) => {
      this._violation.set(v.id, v);
    });
  }

  private getServicesWithViolation(historicalData: THistoricalData[]) {
    if (historicalData.length === 0) return [];
    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());
    const serviceMap = new Map<
      string,
      { count: number; sum: number; quadraticSum: number }
    >();
    historicalData
      .flatMap((h) => h.services)
      .filter((s) => s.risk && s.risk > 0)
      .forEach((s) => {
        const k = s.uniqueServiceName;
        const existing = serviceMap.get(k) || {
          count: 0,
          sum: 0,
          quadraticSum: 0,
        };
        existing.count++;
        existing.sum += s.risk!;
        existing.quadraticSum += Math.pow(s.risk!, 2);
        serviceMap.set(k, existing);
      });

    const latestServices = historicalData[historicalData.length - 1].services;
    const latest = latestServices
      .map((s): [string, number] => [s.uniqueServiceName, s.risk || 0])
      .filter(([, r]) => r > 0);
    const latestMap = new Map(latest);

    const servicesWithViolation = [...serviceMap.entries()]
      .filter(([uniqueServiceName, { count, sum, quadraticSum }]) => {
        const mean = sum / count;
        const stdDev = Math.sqrt(quadraticSum - Math.pow(mean, 2));
        return latestMap.get(uniqueServiceName)! > mean + 3 * stdDev;
      })
      .map(([s]) => s);

    const set = new Set(servicesWithViolation);
    return latestServices.filter((s) => set.has(s.uniqueServiceName));
  }

  private determineEndpointToHighlight(serviceData: THistoricalServiceInfo) {
    if (serviceData.endpoints.length <= 0) return;
    serviceData.endpoints.sort((a, b) => {
      const metricA = a.serverErrors / a.requests;
      const metricB = b.serverErrors / b.requests;
      return metricB - metricA;
    });

    const selected = serviceData.endpoints[0];
    const uniqueLabelName = `${selected.uniqueServiceName}\t${
      selected.method
    }\t${selected.labelName!}`;
    return uniqueLabelName;
  }
}

import AggregateData from "../interfaces/AggregateData";
import RealtimeData from "../interfaces/RealtimeData";
import ServiceDependency from "../interfaces/ServiceDependency";
import Utils from "./Utils";

export default class RiskAnalyzer {
  static RealtimeRisk(
    data: RealtimeData[],
    dependencies: ServiceDependency[],
    replicas: { service: string; replica: number }[]
  ) {
    const impacts = this.Impact(dependencies, replicas);
    const probabilities = this.Probability(data);

    return data.map(({ serviceName, serviceVersion }) => {
      const s = `${serviceName}-${serviceVersion}`;
      const impact = impacts.find(({ service }) => service === s)?.impact || 0;
      const probability =
        probabilities.find(({ service }) => service === s)?.probability || 0;

      return {
        service: serviceName,
        version: serviceVersion,
        risk: impact * probability,
      };
    });
  }

  static CombinedRisk(
    realtimeRisk: { service: string; version: string; risk: number }[],
    aggregateData: AggregateData
  ) {
    const totalDays =
      (aggregateData.toDate.getTime() - aggregateData.fromDate.getTime()) /
      (1000 * 60 * 60 * 24);
    return aggregateData.services.map((s) => {
      const currentRisk =
        realtimeRisk.find(
          ({ service, version }) => service === s.name && version === s.version
        )?.risk || 0;
      return {
        service: s.name,
        version: s.version,
        risk: (currentRisk + s.avgRisk) / (totalDays + 1),
      };
    });
  }

  static Impact(
    dependencies: ServiceDependency[],
    replicas: { service: string; replica: number }[]
  ) {
    return this.RelyingFactor(dependencies).map(({ service, factor }) => ({
      service,
      impact:
        factor /
        (replicas.find(({ service }) => service === service)?.replica || 1),
    }));
  }

  static Probability(data: RealtimeData[]) {
    const reliabilityMetric = this.ReliabilityMetric(data);
    const invokePossibilityAndErrorRate = this.PossibilityAndErrorRate(data);
    return data.map(({ serviceName, serviceVersion }) => ({
      service: `${serviceName}-${serviceVersion}`,
      probability:
        (reliabilityMetric.find(
          (m) => m.service === `${serviceName}-${serviceVersion}`
        )?.metric || 0) *
        (invokePossibilityAndErrorRate.find(
          (m) => m.service === `${serviceName}-${serviceVersion}`
        )?.possibility || 0),
    }));
  }

  static RelyingFactor(dependencies: ServiceDependency[]) {
    return dependencies.map(({ service, links }) => ({
      service,
      factor: links.reduce(
        (acc, cur) =>
          (acc += cur.links.reduce((ac, cu) => ac + cu.count / cu.distance, 0)),
        0
      ),
    }));
  }

  static PossibilityAndErrorRate(
    data: RealtimeData[],
    includeRequestError: boolean = false
  ) {
    const invokedCounts = data
      .map(({ serviceName, serviceVersion, status }) => ({
        service: `${serviceName}-${serviceVersion}`,
        isError:
          status.startsWith("5") ||
          (includeRequestError && status.startsWith("4")),
      }))
      .reduce((acc, cur) => {
        acc.set(cur.service, {
          count: (acc.get(cur.service) || { count: 0 }).count + 1,
          error:
            (acc.get(cur.service) || { error: 0 }).error +
            (cur.isError ? 1 : 0),
        });
        return acc;
      }, new Map<string, { count: number; error: number }>());

    let total = 0;
    invokedCounts.forEach((value) => (total += value.count));

    const invokePossibility: {
      service: string;
      possibility: number;
      errorRate: number;
    }[] = [];
    invokedCounts.forEach((value, key) => {
      invokePossibility.push({
        service: key,
        possibility: value.count / total,
        errorRate: value.error / value.count,
      });
    });
    return invokePossibility;
  }

  static ReliabilityMetric(data: RealtimeData[]) {
    const latencyMap = data.reduce((acc, cur) => {
      const service = `${cur.serviceName}-${cur.serviceVersion}`;
      acc.set(service, (acc.get(service) || []).concat(cur.latency));
      return acc;
    }, new Map<string, number[]>());

    const reliabilityMetric: { service: string; metric: number }[] = [];
    latencyMap.forEach((latencies, service) => {
      reliabilityMetric.push({
        service,
        metric: this.CoefficientOfVariation(latencies),
      });
    });

    const normalizedMetrics = Utils.NormalizeNumbers(
      reliabilityMetric.map(({ metric }) => metric),
      Utils.NormalizeStrategy.BetweenFixedNumber
    );
    return reliabilityMetric.map((m, i) => ({
      ...m,
      norm: normalizedMetrics[i],
    }));
  }

  static CoefficientOfVariation(input: number[]) {
    const mean = input.reduce((a, b) => a + b) / input.length;
    const standardDeviation = Math.sqrt(
      input.reduce((a, b) => a + Math.pow(b, 2), 0) / input.length -
        Math.pow(mean, 2)
    );
    return standardDeviation / mean;
  }
}

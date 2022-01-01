import AggregateData from "../interfaces/AggregateData";
import RealtimeData from "../interfaces/RealtimeData";
import ServiceDependency from "../interfaces/ServiceDependency";
import Utils from "./Utils";

export default class RiskAnalyzer {
  private static readonly MINIMUM_PROB = 0.1;

  static RealtimeRisk(
    data: RealtimeData[],
    dependencies: ServiceDependency[],
    replicas: { service: string; replica: number }[]
  ) {
    const impacts = this.Impact(dependencies, replicas);
    const probabilities = this.Probability(data);

    const risks = [
      ...data
        .map(
          ({ serviceName, serviceVersion }) =>
            `${serviceName}\t${serviceVersion}`
        )
        .reduce((acc, cur) => acc.add(cur), new Set<string>()),
    ]
      .map((s) => s.split("\t"))
      .map(([serviceName, serviceVersion]) => {
        const s = `${serviceName}-${serviceVersion}`;
        const impact =
          impacts.find(({ service }) => service === s)?.impact ||
          this.MINIMUM_PROB;
        const probability =
          probabilities.find(({ service }) => service === s)?.probability ||
          this.MINIMUM_PROB;

        return {
          service: serviceName,
          version: serviceVersion,
          risk: impact * probability,
        };
      });

    const normRisk = Utils.NormalizeNumbers(
      risks.map(({ risk }) => risk),
      Utils.NormalizeStrategy.BetweenFixedNumber
    );

    return risks.map((r, i) => ({ ...r, norm: normRisk[i] }));
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
        )?.risk || this.MINIMUM_PROB;
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
    const rawImpact = this.RelyingFactor(dependencies).map(
      ({ service, factor }) => ({
        service,
        impact:
          factor /
          (replicas.find(({ service }) => service === service)?.replica || 1),
      })
    );

    const normImpact = Utils.NormalizeNumbers(
      rawImpact.map(({ impact }) => impact),
      Utils.NormalizeStrategy.BetweenFixedNumber
    );

    return rawImpact.map((i, iIndex) => ({ ...i, impact: normImpact[iIndex] }));
  }

  static Probability(data: RealtimeData[]) {
    const reliabilityMetric = this.ReliabilityMetric(data);
    const invokePossibilityAndErrorRate = this.PossibilityAndErrorRate(data);
    const rawProb = data.map(({ serviceName, serviceVersion }) => ({
      service: `${serviceName}-${serviceVersion}`,
      probability:
        (reliabilityMetric.find(
          (m) => m.service === `${serviceName}-${serviceVersion}`
        )?.norm || this.MINIMUM_PROB) *
        (invokePossibilityAndErrorRate.find(
          (m) => m.service === `${serviceName}-${serviceVersion}`
        )?.possibility || this.MINIMUM_PROB),
    }));

    const normProb = Utils.NormalizeNumbers(
      rawProb.map(({ probability }) => probability),
      Utils.NormalizeStrategy.BetweenFixedNumber
    );
    return rawProb.map((p, i) => ({ ...p, probability: normProb[i] }));
  }

  static RelyingFactor(dependencies: ServiceDependency[]) {
    return dependencies.map(({ service, links }) => ({
      service,
      factor: links.reduce((acc, cur) => acc + cur.count / cur.distance, 0),
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

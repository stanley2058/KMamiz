import AggregateData from "../interfaces/AggregateData";
import RealtimeData from "../interfaces/RealtimeData";
import ReplicaCount from "../interfaces/ReplicaCount";
import ServiceDependency from "../interfaces/ServiceDependency";
import Utils from "./Utils";

export default class RiskAnalyzer {
  private static readonly MINIMUM_PROB = 0.1;

  static RealtimeRisk(
    data: RealtimeData[],
    dependencies: ServiceDependency[],
    replicas: ReplicaCount[]
  ) {
    data = data.map((d) => ({
      ...d,
      service: `${d.service}\t${d.namespace}\t${d.version}`,
    }));
    dependencies = dependencies.map((d) => ({
      ...d,
      service: `${d.service}\t${d.namespace}\t${d.version}`,
    }));

    const impacts = this.Impact(dependencies, replicas);
    const probabilities = this.Probability(data);

    const risks = [
      ...data.reduce((acc, cur) => acc.add(cur.service), new Set<string>()),
    ].map((s) => {
      const [serviceName, serviceNamespace, serviceVersion] = s.split("\t");
      const impact =
        impacts.find(({ service }) => service === s)?.impact ||
        this.MINIMUM_PROB;
      const probability =
        probabilities.find(({ service }) => service === s)?.probability ||
        this.MINIMUM_PROB;

      return {
        service: serviceName,
        namespace: serviceNamespace,
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
    realtimeRisk: {
      service: string;
      namespace: string;
      version: string;
      risk: number;
    }[],
    aggregateData: AggregateData
  ) {
    const totalDays =
      (aggregateData.toDate.getTime() - aggregateData.fromDate.getTime()) /
      (1000 * 60 * 60 * 24);
    return aggregateData.services.map((s) => {
      const currentRisk =
        realtimeRisk.find(
          ({ service, namespace, version }) =>
            service === s.name &&
            namespace === s.namespace &&
            version === s.version
        )?.risk || this.MINIMUM_PROB;
      return {
        service: s.name,
        version: s.version,
        risk: (currentRisk + s.avgRisk) / (totalDays + 1),
      };
    });
  }

  static Impact(dependencies: ServiceDependency[], replicas: ReplicaCount[]) {
    const rawImpact = this.RelyingFactor(dependencies).map(
      ({ service, factor }) => ({
        service,
        impact:
          factor /
          (replicas.find(
            ({ service: s, namespace: n, version: v }) =>
              service === `${s}\t${n}\t${v}`
          )?.replicas || 1),
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
    const invokePossibilityAndErrorRate =
      this.InvokeProbabilityAndErrorRate(data);
    const rawProb = data.map(({ service: name }) => {
      const { norm } = reliabilityMetric.find((m) => m.service === name) || {
        norm: this.MINIMUM_PROB,
        metric: this.MINIMUM_PROB,
      };
      const { probability: possibility, errorRate } =
        invokePossibilityAndErrorRate.find((m) => m.service === name) || {
          probability: this.MINIMUM_PROB,
          errorRate: this.MINIMUM_PROB,
        };
      return {
        service: name,
        probability: norm * possibility * errorRate,
      };
    });

    const normProb = Utils.NormalizeNumbers(
      rawProb.map(({ probability }) => probability),
      Utils.NormalizeStrategy.BetweenFixedNumber
    );
    return rawProb.map((p, i) => ({ ...p, probability: normProb[i] }));
  }

  static RelyingFactor(dependencies: ServiceDependency[]) {
    return Object.entries(
      dependencies.reduce((prev, { links }) => {
        links.forEach((l) => {
          const uniqueName = `${l.service}\t${l.namespace}\t${l.version}`;
          if (!prev[uniqueName]) {
            prev[uniqueName] = {
              factor: 0,
            };
          }
          prev[uniqueName].factor += l.count / l.distance;
        });
        return prev;
      }, {} as { [id: string]: { factor: number } })
    ).map(([service, { factor }]) => ({ service, factor }));
  }

  /**
   * ACS = AIS x ADS (More info in following source code)
   * @param dependencies
   * @returns ACS score
   */
  static RelyingFactorAlt(dependencies: ServiceDependency[]) {
    /**
     * ACS: Absolute Criticality of the Service
     * AIS: Absolute Importance of the Service
     *      Count of lower dependency
     * ADS: Absolute Dependence of the Service
     *      Count of upper dependency
     */
    return Object.entries(
      dependencies.reduce((prev, { links }) => {
        links
          .filter((l) => l.distance === 1)
          .forEach((l) => {
            const uniqueName = `${l.service}\t${l.namespace}\t${l.version}`;
            if (!prev[uniqueName]) {
              prev[uniqueName] = {
                factor: 0,
              };
            }
            prev[uniqueName].factor += l.count;
          });
        return prev;
      }, {} as { [id: string]: { factor: number } })
    ).map(([service, { factor }]) => ({ service, factor }));
  }

  static InvokeProbabilityAndErrorRate(
    data: RealtimeData[],
    includeRequestError: boolean = false
  ) {
    const invokedCounts = data
      .map(({ service: serviceName, version: serviceVersion, status }) => ({
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

    const invokeProbability: {
      service: string;
      probability: number;
      errorRate: number;
    }[] = [];
    invokedCounts.forEach((value, key) => {
      invokeProbability.push({
        service: key,
        probability: value.count / total,
        errorRate: value.error / value.count,
      });
    });
    return invokeProbability;
  }

  static ReliabilityMetric(data: RealtimeData[]) {
    const latencyMap = data.reduce((acc, cur) => {
      acc.set(cur.service, (acc.get(cur.service) || []).concat(cur.latency));
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

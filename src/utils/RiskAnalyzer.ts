import IAggregateData from "../entities/IAggregateData";
import { IRealtimeData } from "../entities/IRealtimeData";
import IReplicaCount from "../entities/IReplicaCount";
import IServiceDependency from "../entities/IServiceDependency";
import Normalizer from "./Normalizer";

export default class RiskAnalyzer {
  private static readonly MINIMUM_PROB = 0.01;

  static RealtimeRisk(
    data: IRealtimeData[],
    dependencies: IServiceDependency[],
    replicas: IReplicaCount[]
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
      const { impact } = impacts.find(({ service }) => service === s)!;
      const { probability } = probabilities.find(
        ({ service }) => service === s
      )!;

      return {
        service: serviceName,
        namespace: serviceNamespace,
        version: serviceVersion,
        risk: impact * probability,
        impact,
        probability,
      };
    });

    const normRisk = Normalizer.Numbers(
      risks.map(({ risk }) => risk),
      Normalizer.Strategy.BetweenFixedNumber
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
    aggregateData: IAggregateData
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

  static Impact(dependencies: IServiceDependency[], replicas: IReplicaCount[]) {
    const relyingFactor = this.RelyingFactor(dependencies);
    const acs = this.AbsoluteCriticalityOfServices(dependencies);

    const norm = (any: { service: string; factor: number }[]) =>
      Normalizer.Numbers(
        any
          .sort((a, b) => a.service.localeCompare(b.service))
          .map(({ factor }) => factor),
        Normalizer.Strategy.FixedRatio
      );
    const normRf = norm(relyingFactor);
    const normAcs = norm(acs);

    // raw impact = (normRf + normAcs) / replicas
    const rawImpact = dependencies
      .map(({ service }) => service)
      .sort()
      .map((service, i) => ({
        service,
        impact:
          (normRf[i] + normAcs[i]) /
          (replicas.find(
            ({ service: s, namespace: n, version: v }) =>
              service === `${s}\t${n}\t${v}`
          )?.replicas || 1),
      }));

    const normImpact = Normalizer.Numbers(
      rawImpact.map(({ impact }) => impact),
      Normalizer.Strategy.Linear
    );
    return rawImpact.map((i, iIndex) => ({ ...i, impact: normImpact[iIndex] }));
  }

  static Probability(data: IRealtimeData[]) {
    const reliabilityMetric = this.ReliabilityMetric(data);
    const rawInvokeProbabilityAndErrorRate =
      this.InvokeProbabilityAndErrorRate(data);

    const normPro = rawInvokeProbabilityAndErrorRate.map(
      ({ probability }) =>
        probability * (1 - this.MINIMUM_PROB) + this.MINIMUM_PROB
    );
    const normErr = rawInvokeProbabilityAndErrorRate.map(
      ({ errorRate }) => errorRate * (1 - this.MINIMUM_PROB) + this.MINIMUM_PROB
    );
    const baseProb = Normalizer.Numbers(
      normPro.map((p, i) => p * normErr[i]),
      Normalizer.Strategy.Linear,
      this.MINIMUM_PROB
    ).map((prob, i) => ({
      service: rawInvokeProbabilityAndErrorRate[i].service,
      prob,
    }));

    const rawProb = reliabilityMetric.map(({ service: name }) => {
      const { norm } = reliabilityMetric.find((m) => m.service === name)!;
      const { prob } = baseProb.find((m) => m.service === name)!;
      return {
        service: name,
        probability:
          norm * (prob < this.MINIMUM_PROB ? this.MINIMUM_PROB : prob),
      };
    });

    const normProb = Normalizer.Numbers(
      rawProb.map(({ probability }) => probability),
      Normalizer.Strategy.Linear
    );
    return rawProb.map((p, i) => ({ ...p, probability: normProb[i] }));
  }

  static RelyingFactor(dependencies: IServiceDependency[]) {
    return Object.entries(
      dependencies.reduce((prev, { links }) => {
        links.forEach((l) => {
          const uniqueName = `${l.service}\t${l.namespace}\t${l.version}`;
          if (!prev[uniqueName]) {
            prev[uniqueName] = {
              factor: 0,
            };
          }
          prev[uniqueName].factor += l.dependsOn / l.distance;
        });
        return prev;
      }, {} as { [id: string]: { factor: number } })
    ).map(([service, { factor }]) => {
      // if service is being called from external services, e.g., frontend webpages, add 1
      const isGateway = dependencies
        .find((s) => s.service === service)!
        .dependency.find((d) => d.dependBy.length === 0);
      if (isGateway) factor++;

      return {
        service,
        factor,
      };
    });
  }

  /**
   * ACS = AIS x ADS (More info in following source code)
   * If service is a gateway, ADS += 1
   * @param dependencies
   * @returns ACS score
   */
  static AbsoluteCriticalityOfServices(dependencies: IServiceDependency[]) {
    /**
     * ACS: Absolute Criticality of the Service
     * AIS: Absolute Importance of the Service
     *      Count of lower dependency (dependBy/CLIENT)
     * ADS: Absolute Dependence of the Service
     *      Count of upper dependency (dependsOn/SERVER)
     */
    return Object.entries(
      dependencies.reduce((prev, { service, links, dependency }) => {
        const isGateway = dependency.find((d) => d.dependBy.length === 0);
        const { ais, ads } = links
          .filter((l) => l.distance === 1)
          .reduce(
            (prev, l) => {
              if (l.dependBy > 0) prev.ais++;
              if (l.dependsOn > 0) prev.ads++;
              return prev;
            },
            { ais: isGateway ? 1 : 0, ads: 0 }
          );
        prev[service] = { factor: ais * ads };
        return prev;
      }, {} as { [id: string]: { factor: number } })
    ).map(([service, { factor }]) => ({ service, factor }));
  }

  static InvokeProbabilityAndErrorRate(
    data: IRealtimeData[],
    includeRequestError: boolean = false
  ) {
    const invokedCounts = data
      .map(({ service, status }) => ({
        service,
        isError:
          status.startsWith("5") ||
          (includeRequestError && status.startsWith("4")),
      }))
      .reduce((acc, { service, isError }) => {
        const prevVal = acc.get(service) || {
          count: 0,
          error: 0,
        };
        acc.set(service, {
          count: prevVal.count + 1,
          error: prevVal.error + (isError ? 1 : 0),
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

  static ReliabilityMetric(data: IRealtimeData[]) {
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

    const normalizedMetrics = Normalizer.Numbers(
      reliabilityMetric.map(({ metric }) => metric),
      Normalizer.Strategy.Linear,
      this.MINIMUM_PROB
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

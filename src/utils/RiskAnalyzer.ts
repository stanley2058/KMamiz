import { TCombinedRealtimeData } from "../entities/TCombinedRealtimeData";
import { TReplicaCount } from "../entities/TReplicaCount";
import { TRiskResult } from "../entities/TRiskResult";
import { TServiceDependency } from "../entities/TServiceDependency";
import Normalizer from "./Normalizer";

export default class RiskAnalyzer {
  private static readonly MINIMUM_PROB = 0.01;

  static RealtimeRisk(
    data: TCombinedRealtimeData[],
    dependencies: TServiceDependency[],
    replicas: TReplicaCount[]
  ): TRiskResult[] {
    const impacts = this.Impact(dependencies, replicas);
    const probabilities = this.Probability(data);

    const risks = [
      ...data.reduce(
        (acc, cur) => acc.add(cur.uniqueServiceName),
        new Set<string>()
      ),
    ].map((s) => {
      const [serviceName, serviceNamespace, serviceVersion] = s.split("\t");
      const impact =
        impacts.find(({ uniqueServiceName }) => uniqueServiceName === s)
          ?.impact || 0;
      const probability =
        probabilities.find(({ uniqueServiceName }) => uniqueServiceName === s)
          ?.probability || 0;

      return {
        uniqueServiceName: s,
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

  static Impact(dependencies: TServiceDependency[], replicas: TReplicaCount[]) {
    const relyingFactor = this.RelyingFactor(dependencies);
    const acs = this.AbsoluteCriticalityOfServices(dependencies);

    const norm = (any: { uniqueServiceName: string; factor: number }[]) =>
      Normalizer.Numbers(
        any
          .sort((a, b) =>
            a.uniqueServiceName.localeCompare(b.uniqueServiceName)
          )
          .map(({ factor }) => factor),
        Normalizer.Strategy.FixedRatio
      );
    const normRf = norm(relyingFactor);
    const normAcs = norm(acs);

    // raw impact = (normRf + normAcs) / replicas
    const rawImpact = dependencies
      .map(({ uniqueServiceName }) => uniqueServiceName)
      .sort()
      .map((uniqueServiceName, i) => ({
        uniqueServiceName,
        impact:
          (normRf[i] + normAcs[i]) /
          (replicas.find(
            ({ uniqueServiceName: sName }) => sName === uniqueServiceName
          )?.replicas || 1),
      }));

    const normImpact = Normalizer.Numbers(
      rawImpact.map(({ impact }) => impact),
      Normalizer.Strategy.Linear
    );
    return rawImpact.map((i, iIndex) => ({ ...i, impact: normImpact[iIndex] }));
  }

  static Probability(data: TCombinedRealtimeData[]) {
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
      uniqueServiceName: rawInvokeProbabilityAndErrorRate[i].uniqueServiceName,
      prob,
    }));

    const rawProb = reliabilityMetric.map(({ uniqueServiceName: name }) => {
      const { norm } = reliabilityMetric.find(
        (m) => m.uniqueServiceName === name
      )!;
      const { prob } = baseProb.find((m) => m.uniqueServiceName === name)!;
      return {
        uniqueServiceName: name,
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

  static RelyingFactor(dependencies: TServiceDependency[]) {
    const factorMap = new Map<string, number>();
    dependencies.forEach(({ uniqueServiceName, links, dependency }) => {
      const factor = links.reduce(
        (prev, curr) => prev + curr.dependingBy / curr.distance,
        0
      );
      const isGateway = dependency.find((d) => d.dependingBy.length === 0);
      factorMap.set(uniqueServiceName, factor + (isGateway ? 1 : 0));
    });
    return [...factorMap.entries()].map(([uniqueServiceName, factor]) => ({
      uniqueServiceName,
      factor,
    }));
  }

  /**
   * ACS = AIS x ADS (More info in following source code)
   * If service is a gateway, ADS += 1
   * @param dependencies
   * @returns ACS score
   */
  static AbsoluteCriticalityOfServices(dependencies: TServiceDependency[]) {
    /**
     * ACS: Absolute Criticality of the Service
     * AIS: Absolute Importance of the Service
     *      Count of lower dependency (dependingBy/CLIENT)
     * ADS: Absolute Dependence of the Service
     *      Count of upper dependency (dependingOn/SERVER)
     */
    return dependencies.map(({ uniqueServiceName, links, dependency }) => {
      const isGateway = dependency.find((d) => d.dependingBy.length === 0);
      const { ais, ads } = links
        .filter((l) => l.distance === 1)
        .reduce(
          (prev, l) => {
            if (l.dependingBy > 0) prev.ais++;
            if (l.dependingOn > 0) prev.ads++;
            return prev;
          },
          { ais: isGateway ? 1 : 0, ads: 0 }
        );
      const factor = ais * ads;
      return { uniqueServiceName, factor, ais, ads };
    });
  }

  static InvokeProbabilityAndErrorRate(
    data: TCombinedRealtimeData[],
    includeRequestError: boolean = false
  ) {
    const invokedCounts = data
      .map(({ uniqueServiceName, status }) => ({
        uniqueServiceName,
        isError:
          status.startsWith("5") ||
          (includeRequestError && status.startsWith("4")),
      }))
      .reduce((acc, { uniqueServiceName, isError }) => {
        const prevVal = acc.get(uniqueServiceName) || {
          count: 0,
          error: 0,
        };
        acc.set(uniqueServiceName, {
          count: prevVal.count + 1,
          error: prevVal.error + (isError ? 1 : 0),
        });
        return acc;
      }, new Map<string, { count: number; error: number }>());

    let total = 0;
    invokedCounts.forEach((value) => (total += value.count));

    const invokeProbability: {
      uniqueServiceName: string;
      probability: number;
      errorRate: number;
    }[] = [];
    invokedCounts.forEach((value, key) => {
      invokeProbability.push({
        uniqueServiceName: key,
        probability: value.count / total,
        errorRate: value.error / value.count,
      });
    });
    return invokeProbability;
  }

  static ReliabilityMetric(data: TCombinedRealtimeData[]) {
    const reliabilityMetric = this.GetWorseLatencyCVOfServices(data);

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

  static GetWorseLatencyCVOfServices(serviceData: TCombinedRealtimeData[]) {
    const latencyMap = new Map<string, number>();
    serviceData.forEach((rl) => {
      const existing = latencyMap.get(rl.uniqueServiceName) || 0;
      latencyMap.set(
        rl.uniqueServiceName,
        existing > rl.latency.cv ? existing : rl.latency.cv
      );
    });
    return [...latencyMap.entries()].map(([uniqueServiceName, metric]) => ({
      uniqueServiceName,
      metric,
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

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
          ?.probability || RiskAnalyzer.MINIMUM_PROB;

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
    ).map((prob, i): [string, number] => [
      rawInvokeProbabilityAndErrorRate[i].uniqueServiceName,
      prob,
    ]);

    const baseProbMap = new Map(baseProb);
    const rawProb = reliabilityMetric.map(({ uniqueServiceName, norm }) => {
      const prob = baseProbMap.get(uniqueServiceName)!;
      return {
        uniqueServiceName,
        probability:
          norm * (prob < this.MINIMUM_PROB ? this.MINIMUM_PROB : prob),
      };
    });

    return rawProb.map((p) => ({
      ...p,
      probability: p.probability * (1 - this.MINIMUM_PROB) + this.MINIMUM_PROB,
    }));
  }

  static RelyingFactor(dependencies: TServiceDependency[]) {
    const factorMap = new Map<string, number>();
    dependencies.forEach(({ uniqueServiceName, links, dependency }) => {
      const factor = links
        .flatMap((l) => l.details)
        .reduce((prev, curr) => prev + curr.dependingBy / curr.distance, 0);
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
        .flatMap((l) => l.details)
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
    const invokedCounts = new Map<string, { count: number; error: number }>();
    data
      .map(({ uniqueServiceName, status, combined }) => ({
        uniqueServiceName,
        isError:
          status.startsWith("5") ||
          (includeRequestError && status.startsWith("4")),
        combined,
      }))
      .forEach(({ uniqueServiceName, isError, combined }) => {
        const prevVal = invokedCounts.get(uniqueServiceName) || {
          count: 0,
          error: 0,
        };
        invokedCounts.set(uniqueServiceName, {
          count: prevVal.count + combined,
          error: prevVal.error + (isError ? combined : 0),
        });
      });

    const total = [...invokedCounts.values()].reduce(
      (prev, curr) => prev + curr.count,
      0
    );

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
    const reliabilityMetric = this.GetLatencyCVOfServices(data);

    const normalizedMetrics = Normalizer.Numbers(
      reliabilityMetric.map(({ metric }) => metric),
      Normalizer.Strategy.SigmoidAdj
    );
    return reliabilityMetric.map((m, i) => ({
      ...m,
      norm: normalizedMetrics[i],
    }));
  }

  static GetLatencyCVOfServices(serviceData: TCombinedRealtimeData[]) {
    const dataMap = new Map<string, TCombinedRealtimeData[]>();
    serviceData.forEach((s) => {
      const key = s.uniqueServiceName;
      dataMap.set(key, (dataMap.get(key) || []).concat([s]));
    });

    return [...dataMap.entries()].map(([uniqueServiceName, data]) => {
      let total = 0;
      let sum = 0;
      data.forEach((d) => {
        sum += d.latency.cv * d.combined;
        total += d.combined;
      });

      return {
        uniqueServiceName,
        metric: sum / total,
      };
    });
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

import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import EndpointDataType from "../classes/EndpointDataType";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TLineChartData } from "../entities/TLineChartData";
import { TGraphData } from "../entities/TGraphData";
import IRequestHandler from "../entities/TRequestHandler";
import { TServiceCohesion } from "../entities/TServiceCohesion";
import { TTotalServiceInterfaceCohesion } from "../entities/TTotalServiceInterfaceCohesion";
import DataCache from "../services/DataCache";
import ServiceUtils from "../services/ServiceUtils";
import { TRequestInfoChartData } from "../entities/TRequestInfoChartData";

export default class GraphService extends IRequestHandler {
  constructor() {
    super("graph");
    this.addRoute(
      "get",
      "/dependency/endpoint/:namespace?",
      async (req, res) => {
        const graph = await this.getDependencyGraph(req.params["namespace"]);
        if (graph) res.json(graph);
        else res.sendStatus(404);
      }
    );
    this.addRoute(
      "get",
      "/dependency/service/:namespace?",
      async (req, res) => {
        const graph = await this.getServiceDependencyGraph(
          req.params["namespace"]
        );
        if (graph) res.json(graph);
        else res.sendStatus(404);
      }
    );
    this.addRoute("get", "/chord/direct/:namespace?", async (req, res) => {
      res.json(await this.getDirectServiceChord(req.params["namespace"]));
    });
    this.addRoute("get", "/chord/indirect/:namespace?", async (req, res) => {
      res.json(await this.getInDirectServiceChord(req.params["namespace"]));
    });
    this.addRoute("get", "/line/:namespace?", async (req, res) => {
      const notBeforeQuery = req.query["notBefore"] as string;
      const notBefore = notBeforeQuery ? parseInt(notBeforeQuery) : undefined;
      res.json(await this.getLineChartData(req.params["namespace"], notBefore));
    });
    this.addRoute("get", "/cohesion/:namespace?", async (req, res) => {
      res.json(this.getServiceCohesion(req.params["namespace"]));
    });
    this.addRoute("get", "/instability/:namespace?", async (req, res) => {
      res.json(this.getServiceInstability(req.params["namespace"]));
    });
    this.addRoute("get", "/coupling/:namespace?", async (req, res) => {
      res.json(this.getServiceCoupling(req.params["namespace"]));
    });
    this.addRoute("get", "/requests/:uniqueName", async (req, res) => {
      const notBeforeQuery = req.query["notBefore"] as string;
      const notBefore = notBeforeQuery ? parseInt(notBeforeQuery) : undefined;
      res.json(
        await this.getRequestInfoChartData(
          decodeURIComponent(req.params["uniqueName"]),
          req.query["ignoreServiceVersion"] === "true",
          notBefore
        )
      );
    });
  }

  async getDependencyGraph(namespace?: string) {
    return DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData(namespace)
      ?.toGraphData();
  }

  async getServiceDependencyGraph(namespace?: string) {
    const endpointGraph = await this.getDependencyGraph(namespace);
    if (!endpointGraph) return endpointGraph;

    const linkSet = new Set<string>();
    endpointGraph.links.forEach((l) => {
      const source = l.source.split("\t").slice(0, 2).join("\t");
      const target = l.target.split("\t").slice(0, 2).join("\t");
      linkSet.add(`${source}\n${target}`);
    });

    const links = [...linkSet]
      .map((l) => l.split("\n"))
      .map(([source, target]) => ({ source, target }));

    const nodes = endpointGraph.nodes.filter((n) => n.id === n.group);
    nodes.forEach((n) => {
      n.linkInBetween = links.filter((l) => l.source === n.id);
      n.dependencies = n.linkInBetween.map((l) => l.target);
    });

    const graph: TGraphData = {
      nodes,
      links,
    };
    return graph;
  }

  async getDirectServiceChord(namespace?: string) {
    const dependencies = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData(namespace);
    if (!dependencies) return { nodes: [], links: [] };
    const dep = dependencies.toJSON();
    return new EndpointDependencies(
      dep.map((ep) => {
        const dependingOn = ep.dependingOn.filter((d) => d.distance === 1);
        return {
          ...ep,
          dependingOn,
        };
      })
    ).toChordData();
  }

  async getInDirectServiceChord(namespace?: string) {
    return (
      DataCache.getInstance()
        .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
        .getData(namespace)
        ?.toChordData() || { nodes: [], links: [] }
    );
  }

  async getLineChartData(
    namespace?: string,
    notBefore?: number
  ): Promise<TLineChartData> {
    const historicalData =
      await ServiceUtils.getInstance().getRealtimeHistoricalData(
        namespace,
        notBefore
      );

    if (historicalData.length === 0) {
      return {
        dates: [],
        metrics: [],
        services: [],
      };
    }

    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());
    const dates: number[] = [];
    const metrics: [number, number, number, number, number][][] = [];
    const services = historicalData[0].services
      .sort((a, b) => a.uniqueServiceName.localeCompare(b.uniqueServiceName))
      .map((s) => `${s.service}.${s.namespace} (${s.version})`);

    historicalData.forEach((h) => {
      dates.push(h.date.getTime());
      h.services.sort((a, b) =>
        a.uniqueServiceName.localeCompare(b.uniqueServiceName)
      );
      const metric = h.services.map(
        (s): [number, number, number, number, number] => {
          const requestErrors = s.requestErrors;
          const serverErrors = s.serverErrors;
          const requests = s.requests - requestErrors - serverErrors;

          return [
            requests,
            requestErrors,
            serverErrors,
            s.latencyCV,
            s.risk || 0,
          ];
        }
      );
      metrics.push(metric);
    });

    return {
      dates,
      services,
      metrics,
    };
  }

  getServiceCohesion(namespace?: string) {
    const dependencies = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData(namespace);
    if (!dependencies) return [];

    const dataType = DataCache.getInstance()
      .get<CEndpointDataType>("EndpointDataType")
      .getData()
      .map((e) => {
        const raw = e.toJSON();
        raw.labelName =
          DataCache.getInstance()
            .get<CLabelMapping>("LabelMapping")
            .getData()
            ?.get(raw.uniqueEndpointName) || raw.uniqueEndpointName;
        return new EndpointDataType(raw);
      });

    const dataCohesion = EndpointDataType.GetServiceCohesion(dataType).reduce(
      (map, d) => map.set(d.uniqueServiceName, d),
      new Map<string, TServiceCohesion>()
    );

    const usageCohesions = dependencies.toServiceEndpointCohesion();

    const results = usageCohesions.map((u): TTotalServiceInterfaceCohesion => {
      const uniqueServiceName = u.uniqueServiceName;
      const [service, namespace, version] = uniqueServiceName.split("\t");
      const dCohesion = dataCohesion.get(uniqueServiceName)!;
      return {
        uniqueServiceName,
        name: `${service}.${namespace} (${version})`,
        dataCohesion: dCohesion.cohesiveness,
        usageCohesion: u.endpointUsageCohesion,
        totalInterfaceCohesion:
          (dCohesion.cohesiveness + u.endpointUsageCohesion) / 2,
        endpointCohesion: dCohesion.endpointCohesion,
        totalEndpoints: u.totalEndpoints,
        consumers: u.consumers,
      };
    });
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  getServiceInstability(namespace?: string) {
    const dependencies = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData(namespace);
    if (!dependencies) return [];
    return dependencies
      .toServiceInstability()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getServiceCoupling(namespace?: string) {
    const dependencies = DataCache.getInstance()
      .get<CLabeledEndpointDependencies>("LabeledEndpointDependencies")
      .getData(namespace);
    if (!dependencies) return [];
    return dependencies
      .toServiceCoupling()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRequestInfoChartData(
    uniqueName: string,
    ignoreServiceVersion = false,
    notBefore: number = 86400000
  ) {
    const [service, namespace, version, method, labelName] =
      uniqueName.split("\t");
    const isEndpoint = method && labelName;
    const uniqueServiceName = `${service}\t${namespace}\t${version}`;
    const historicalData =
      await ServiceUtils.getInstance().getRealtimeHistoricalData(
        undefined,
        notBefore
      );
    const filtered = historicalData
      .flatMap((h) => h.services)
      .filter((s) => {
        if (ignoreServiceVersion) {
          return s.service === service && s.namespace === namespace;
        }
        return s.uniqueServiceName === uniqueServiceName;
      });

    const chartData: TRequestInfoChartData = {
      time: [],
      requests: [],
      clientErrors: [],
      serverErrors: [],
      latencyCV: [],
      risks: isEndpoint ? undefined : [],
      totalRequestCount: 0,
      totalClientErrors: 0,
      totalServerErrors: 0,
    };

    filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
    const source = isEndpoint
      ? filtered.map((s) => {
          const endpoint = s.endpoints.find(
            (e) => e.labelName === labelName && e.method === method
          );
          return {
            date: s.date,
            risk: undefined,
            ...endpoint,
          };
        })
      : filtered;

    source.forEach((s) => {
      const clientError = s.requestErrors || 0;
      const serverError = s.serverErrors || 0;
      const request = (s.requests || 0) - serverError - clientError;

      chartData.time.push(s.date.getTime());
      chartData.requests.push(request);
      chartData.clientErrors.push(clientError);
      chartData.serverErrors.push(serverError);
      chartData.latencyCV.push(s.latencyCV || 0);
      if (!isEndpoint) {
        chartData.risks!.push(s.risk || 0);
      }

      chartData.totalRequestCount += request;
      chartData.totalClientErrors += clientError;
      chartData.totalServerErrors += serverError;
    });

    return chartData;
  }
}

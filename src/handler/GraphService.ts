import EndpointDataType from "../classes/EndpointDataType";
import { EndpointDependencies } from "../classes/EndpointDependencies";
import { TAreaLineChartData } from "../entities/TAreaLineChartData";
import { TGraphData } from "../entities/TGraphData";
import IRequestHandler from "../entities/TRequestHandler";
import { TServiceCohesion } from "../entities/TServiceCohesion";
import { TTotalServiceInterfaceCohesion } from "../entities/TTotalServiceInterfaceCohesion";
import DataCache from "../services/DataCache";

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
      res.json(await this.getAreaLineData(req.params["namespace"]));
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
  }

  async getDependencyGraph(namespace?: string) {
    return DataCache.getInstance()
      .getEndpointDependenciesSnap(namespace)
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
    const dependencies =
      DataCache.getInstance().getEndpointDependenciesSnap(namespace);
    if (!dependencies) return [];
    const dep = dependencies.toJSON();
    dep.forEach((ep) => {
      ep.dependsOn = ep.dependsOn.filter((d) => d.distance === 1);
    });
    return new EndpointDependencies(dep).toChordData();
  }

  async getInDirectServiceChord(namespace?: string) {
    return (
      DataCache.getInstance()
        .getEndpointDependenciesSnap(namespace)
        ?.toChordData() || []
    );
  }

  async getAreaLineData(namespace?: string): Promise<TAreaLineChartData[]> {
    const historyData = await DataCache.getInstance().getRealtimeHistoryData(
      namespace
    );
    return historyData
      .map((h) => {
        return h.services.map((s) => {
          const name = `${s.service}.${s.namespace} (${s.version})`;
          return {
            name,
            x: s.date,
            requests: s.requests,
            serverErrors: s.serverErrors,
            requestErrors: s.requestErrors,
            latencyCV: s.latencyCV,
            risk: s.risk,
          };
        });
      })
      .flat();
  }

  getServiceCohesion(namespace?: string) {
    const dependencies =
      DataCache.getInstance().getEndpointDependenciesSnap(namespace);
    if (!dependencies) return [];

    const dataType = DataCache.getInstance().endpointDataTypeSnap.map((e) => {
      const raw = e.toJSON();
      raw.labelName =
        DataCache.getInstance().labelMapping.get(raw.uniqueEndpointName) ||
        raw.uniqueEndpointName;
      return new EndpointDataType(raw);
    });

    const dataCohesion = EndpointDataType.GetServiceCohesion(dataType).reduce(
      (map, d) => map.set(d.uniqueServiceName, d),
      new Map<string, TServiceCohesion>()
    );

    const usageCohesions = dependencies.toServiceEndpointCohesion();

    return usageCohesions.map((u): TTotalServiceInterfaceCohesion => {
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
  }

  getServiceInstability(namespace?: string) {
    const dependencies =
      DataCache.getInstance().getEndpointDependenciesSnap(namespace);
    if (!dependencies) return [];
    return dependencies.toServiceInstability();
  }

  getServiceCoupling(namespace?: string) {
    const dependencies =
      DataCache.getInstance().getEndpointDependenciesSnap(namespace);
    if (!dependencies) return [];
    return dependencies.toServiceCoupling();
  }
}

import { EndpointDependencies } from "../classes/EndpointDependency";
import IAreaLineChartData from "../entities/IAreaLineChartData";
import IGraphData from "../entities/IGraphData";
import IRequestHandler from "../entities/IRequestHandler";
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

    const graph: IGraphData = {
      nodes,
      links,
    };
    return graph;
  }

  async getDirectServiceChord(namespace?: string) {
    const dependencies =
      DataCache.getInstance().getEndpointDependenciesSnap(namespace);
    if (!dependencies) return [];
    const dep = dependencies.dependencies;
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

  async getAreaLineData(namespace?: string): Promise<IAreaLineChartData[]> {
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
}

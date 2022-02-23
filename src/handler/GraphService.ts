import { EndpointDependencies } from "../classes/EndpointDependency";
import IAreaLineChartData from "../entities/IAreaLineChartData";
import IRequestHandler from "../entities/IRequestHandler";
import KubernetesService from "../services/KubernetesService";
import MongoOperator from "../services/MongoOperator";
import DataCache from "../services/DataCache";
import Utils from "../utils/Utils";

export default class GraphService extends IRequestHandler {
  constructor() {
    super("graph");
    this.addRoute("get", "/dependency/:namespace?", async (req, res) => {
      res.json(await this.getDependencyGraph(req.params["namespace"]));
    });
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
    return (
      await MongoOperator.getInstance().getEndpointDependencies(namespace)
    ).toGraphData();
  }

  async getDirectServiceChord(namespace?: string) {
    const dependencies =
      await MongoOperator.getInstance().getEndpointDependencies(namespace);
    const dep = dependencies.dependencies;
    dep.forEach((ep) => {
      ep.dependsOn = ep.dependsOn.filter((d) => d.distance === 1);
    });
    return new EndpointDependencies(dep).toChordData();
  }

  async getInDirectServiceChord(namespace?: string) {
    const dependencies =
      await MongoOperator.getInstance().getEndpointDependencies(namespace);
    return dependencies.toChordData();
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

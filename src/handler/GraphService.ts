import { EndpointDependencies } from "../classes/EndpointDependency";
import { Trace } from "../classes/Trace";
import IAreaLineChartData from "../entities/IAreaLineChartData";
import IRequestHandler from "../entities/IRequestHandler";
import MongoOperator from "../services/MongoOperator";
import ZipkinService from "../services/ZipkinService";

export default class GraphService extends IRequestHandler {
  constructor() {
    super("graph");
    this.addRoute("get", "/dependency/:namespace", async (req, res) => {
      res.json(await this.getDependencyGraph(req.params["namespace"]));
    });
    this.addRoute("get", "/chord/direct/:namespace", async (req, res) => {
      res.json(await this.getDirectServiceChord(req.params["namespace"]));
    });
    this.addRoute("get", "/chord/indirect/:namespace", async (req, res) => {
      res.json(await this.getInDirectServiceChord(req.params["namespace"]));
    });
    this.addRoute("get", "/line/:namespace", async (req, res) => {
      res.json(await this.getAreaLineData(req.params["namespace"]));
    });
  }

  private async getTraces(namespace?: string): Promise<Trace> {
    const traces =
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30
      );
    // TODO: filter by namespace
    return new Trace(traces);
  }

  async getDependencyGraph(namespace?: string) {
    return (await this.getTraces(namespace))
      .toEndpointDependencies()
      .toGraphData();
  }

  async getDirectServiceChord(namespace?: string) {
    return new EndpointDependencies(
      (await this.getTraces(namespace))
        .toEndpointDependencies()
        .dependencies.map((ep) => ({
          ...ep,
          dependsOn: ep.dependsOn.filter((d) => d.distance === 1),
        }))
    ).toChordData();
  }

  async getInDirectServiceChord(namespace?: string) {
    return (await this.getTraces(namespace))
      .toEndpointDependencies()
      .toChordData();
  }

  async getAreaLineData(namespace?: string): Promise<IAreaLineChartData[]> {
    const historyData = await MongoOperator.getInstance().getHistoryData(
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

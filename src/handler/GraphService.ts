import { EndpointDependencies } from "../classes/EndpointDependency";
import { Trace } from "../classes/Trace";
import { IEndpointDependency } from "../entities/IEndpointDependency";
import IRequestHandler from "../entities/IRequestHandler";
import ZipkinService from "../services/ZipkinService";

export default class GraphService extends IRequestHandler {
  constructor() {
    super("graph");
    this.addRoute("get", "/dependency", async (_, res) => {
      res.json(await this.getDependencyGraph());
    });
    this.addRoute("get", "/chord/direct", async (_, res) => {
      res.json(await this.getDirectServiceChord());
    });
    this.addRoute("get", "/chord/indirect", async (_, res) => {
      res.json(await this.getInDirectServiceChord());
    });
  }

  private async getTraces(): Promise<Trace> {
    return new Trace(
      await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
        86400000 * 30
      )
    );
  }

  async getDependencyGraph() {
    return (await this.getTraces()).toEndpointDependencies().toGraphData();
  }

  async getDirectServiceChord() {
    return new EndpointDependencies(
      (await this.getTraces())
        .toEndpointDependencies()
        .dependencies.map((ep) => ({
          ...ep,
          dependsOn: ep.dependsOn.filter((d) => d.distance === 1),
        }))
    ).toChordData();
  }

  async getInDirectServiceChord() {
    return (await this.getTraces()).toEndpointDependencies().toChordData();
  }
}

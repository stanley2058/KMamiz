import { IEndpointDependency } from "../entities/IEndpointDependency";
import IGraphData from "../entities/IGraphData";
import IServiceDependency, {
  IServiceLinkInfo,
} from "../entities/IServiceDependency";

export class EndpointDependencies {
  private readonly _dependencies: IEndpointDependency[];
  constructor(dependencies: IEndpointDependency[]) {
    this._dependencies = dependencies;
  }

  get dependencies() {
    return this._dependencies;
  }

  toGraphData() {
    const initialGraphData: IGraphData = {
      nodes: [
        ...this._dependencies.reduce(
          (prev, e) => prev.add(e.endpoint.service),
          new Set<string>()
        ),
      ].map((e) => ({
        id: e,
        name: e,
        group: e,
      })),
      links: this._dependencies.map((e) => ({
        source: e.endpoint.service,
        target: `${e.endpoint.version}-${e.endpoint.name}`,
      })),
    };

    return this._dependencies.reduce(
      (prev, { endpoint, dependsOn: dependencies }) => {
        // add self node into graph nodes
        prev.nodes.push({
          id: `${endpoint.version}-${endpoint.name}`,
          name: `(${endpoint.service} ${endpoint.version}) ${endpoint.path}`,
          group: endpoint.service,
        });

        // create links
        dependencies.forEach((dependency) => {
          const source = `${endpoint.version}-${endpoint.name}`;
          prev.links = prev.links.concat(
            this._dependencies
              .filter(
                (e) =>
                  e.endpoint.name === dependency.endpoint.name &&
                  dependency.distance === 1
              )
              .map((e) => `${e.endpoint.version}-${e.endpoint.name}`)
              .map((target) => ({ source, target }))
          );
        });
        return prev;
      },
      initialGraphData
    );
  }

  toServiceDependencies() {
    // gather all service info from endpointDependencies
    const serviceTemplates = [
      ...this._dependencies.reduce(
        (prev, { endpoint }) =>
          prev.add(
            `${endpoint.service}\t${endpoint.namespace}\t${endpoint.version}`
          ),
        new Set<string>()
      ),
    ].map((s) => {
      // map service info to an unique name for easy comparison
      const [service, namespace, version] = s.split("\t");
      return {
        uniqueName: `${service}\t${namespace}\t${version}`,
      };
    });

    // create service dependencies
    return serviceTemplates.map(({ uniqueName }) => {
      // find dependencies for the current service
      const dependency = this._dependencies.filter(
        ({ endpoint }) =>
          `${endpoint.service}\t${endpoint.namespace}\t${endpoint.version}` ===
          uniqueName
      );

      // create links info from endpointDependencies
      const linkMap =
        EndpointDependencies.createServiceToLinksMapping(dependency);

      // combine all previous data to create a service dependency
      const [service, namespace, version] = uniqueName.split("\t");
      return {
        service,
        namespace,
        version,
        dependency,
        links: Object.entries(linkMap).map(([uniqueName, info]) => {
          const [service, namespace, version] = uniqueName.split("\t");
          return {
            service,
            namespace,
            version,
            ...info,
          };
        }),
      } as IServiceDependency;
    });
  }

  private static createServiceToLinksMapping(
    dependency: IEndpointDependency[]
  ) {
    // create links info from endpointDependencies
    const linkMap = dependency
      .map((dep) => [...dep.dependsOn, ...dep.dependBy])
      .flat()
      .map((dep) => {
        const { service: serviceName, namespace, version } = dep.endpoint;
        return {
          uniqueName: `${serviceName}\t${namespace}\t${version}`,
          distance: dep.distance,
          type: dep.type,
        };
      })
      .reduce((prev, { uniqueName, distance, type }) => {
        if (!prev[uniqueName]) {
          prev[uniqueName] = {
            distance,
            count: 1,
            dependBy: type === "CLIENT" ? 1 : 0,
            dependsOn: type === "SERVER" ? 1 : 0,
          };
        } else {
          prev[uniqueName].count++;
          if (type === "CLIENT") prev[uniqueName].dependBy++;
          else prev[uniqueName].dependsOn++;
        }
        return prev;
      }, {} as { [uniqueName: string]: IServiceLinkInfo });
    return linkMap;
  }
}

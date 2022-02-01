import { IEndpointDependency } from "../entities/IEndpointDependency";
import IGraphData, { ILink, INode } from "../entities/IGraphData";
import IServiceDependency, {
  IServiceLinkInfo,
} from "../entities/IServiceDependency";
import Utils from "../utils/Utils";

export class EndpointDependencies {
  private readonly _dependencies: IEndpointDependency[];
  constructor(dependencies: IEndpointDependency[]) {
    this._dependencies = dependencies;
  }

  get dependencies() {
    return this._dependencies;
  }

  toGraphData() {
    const serviceEndpointMap = new Map<string, IEndpointDependency[]>();

    this._dependencies.forEach((dep) => {
      const uniqueName = `${dep.endpoint.service}\t${dep.endpoint.namespace}`;
      serviceEndpointMap.set(uniqueName, [
        ...(serviceEndpointMap.get(uniqueName) || []),
        dep,
      ]);
    });

    const nodes: INode[] = [
      {
        id: "null",
        group: "null",
        name: "external requests",
      },
    ];
    const links: ILink[] = [];
    const services: string[] = [];
    [...serviceEndpointMap.entries()].forEach(([service, endpoint]) => {
      services.push(service);
      nodes.push({
        id: service,
        group: service,
        name: service.replace("\t", "."),
      });

      endpoint.forEach((e) => {
        const [, , path] = Utils.ExplodeUrl(e.endpoint.name, true);
        const id = `${service}\t${e.endpoint.version}\t${path}`;
        nodes.push({
          id,
          group: service,
          name: `(${service.replace("\t", ".")} ${e.endpoint.version}) ${path}`,
        });
        links.push({
          source: service,
          target: id,
        });
        e.dependsOn
          .filter((dep) => dep.distance === 1)
          .forEach((dep) => {
            const [, , path] = Utils.ExplodeUrl(dep.endpoint.name, true);
            const depId = `${dep.endpoint.service}\t${dep.endpoint.namespace}\t${dep.endpoint.version}\t${path}`;
            links.push({
              source: id,
              target: depId,
            });
          });
        if (e.dependBy.length === 0) {
          links.push({
            source: "null",
            target: id,
          });
        }
      });
    });
    return {
      nodes,
      links,
      services,
    } as IGraphData;
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

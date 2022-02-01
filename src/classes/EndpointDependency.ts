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

    const { nodes: bNodes, links: bLinks } =
      this.createBaseNodesAndLinks(serviceEndpointMap);
    return this.createHighlightNodesAndLinks(bNodes, bLinks) as IGraphData;
  }

  private createBaseNodesAndLinks(
    serviceEndpointMap: Map<string, IEndpointDependency[]>
  ) {
    const nodes: INode[] = [
      // root node (external)
      {
        id: "null",
        group: "null",
        name: "external requests",
        dependencies: [],
        linkInBetween: [],
      },
    ];
    const links: ILink[] = [];
    [...serviceEndpointMap.entries()].forEach(([service, endpoint]) => {
      // service node
      nodes.push({
        id: service,
        group: service,
        name: service.replace("\t", "."),
        dependencies: [],
        linkInBetween: [],
      });

      endpoint.forEach((e) => {
        const [, , path] = Utils.ExplodeUrl(e.endpoint.name, true);
        const id = `${service}\t${e.endpoint.version}\t${e.endpoint.name}`;
        // endpoint node
        nodes.push({
          id,
          group: service,
          name: `(${e.endpoint.version}) ${path}`,
          dependencies: [],
          linkInBetween: [],
        });

        // service to endpoint links
        links.push({
          source: service,
          target: id,
        });

        // endpoint to endpoint links
        e.dependsOn
          .filter((dep) => dep.distance === 1)
          .forEach((dep) => {
            const depId = `${dep.endpoint.service}\t${dep.endpoint.namespace}\t${dep.endpoint.version}\t${dep.endpoint.name}`;
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

    return { nodes, links };
  }
  private createHighlightNodesAndLinks(nodes: INode[], links: ILink[]) {
    const dependencyWithId = this._dependencies.map((dep) => ({
      ...dep,
      uid: `${dep.endpoint.service}\t${dep.endpoint.namespace}\t${dep.endpoint.version}\t${dep.endpoint.name}`,
      sid: `${dep.endpoint.service}\t${dep.endpoint.namespace}`,
    }));

    nodes = nodes.map((n) => {
      if (n.id === "null") {
        // root node
        n.dependencies = dependencyWithId
          .filter((d) => d.dependBy.length === 0)
          .map(({ uid }) => uid);
        n.linkInBetween = n.dependencies.map((d) => ({
          source: "null",
          target: d,
        }));
      } else if (n.id === n.group) {
        // service node
        n.dependencies = dependencyWithId
          .filter((d) => d.sid === n.id)
          .map(({ uid }) => uid);
        n.linkInBetween = n.dependencies.map((d) => ({
          source: n.id,
          target: d,
        }));
      } else {
        // endpoint node
        const remap = (list: any[]) =>
          list.map(
            ({ endpoint: { service, namespace, version, name } }) =>
              `${service}\t${namespace}\t${version}\t${name}`
          );
        const node = dependencyWithId.find((d) => d.uid === n.id)!;
        const dependsOnSet = new Set(remap(node.dependsOn));
        const dependBySet = new Set(remap(node.dependBy));

        n.linkInBetween = [
          ...[...dependBySet].map((d) =>
            links.find(
              (l) =>
                l.source === d &&
                (dependBySet.has(l.target) || l.target === n.id)
            )
          ),
          ...[...dependsOnSet].map((d) =>
            links.find(
              (l) =>
                l.target === d &&
                (dependsOnSet.has(l.source) || l.source === n.id)
            )
          ),
        ].filter((l) => !!l) as ILink[];
        n.dependencies = [...dependBySet, ...dependsOnSet];
      }
      return n;
    });
    return { nodes, links };
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

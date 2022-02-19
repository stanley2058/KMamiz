import {
  IEndpointDependency,
  TEndpointDependency,
} from "../entities/IEndpointDependency";
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
        const id = `${e.endpoint.uniqueServiceName}\t${e.endpoint.method}\t${e.endpoint.labelName}`;
        // if endpoint.name changed to none service url, change this
        const [, , path] = Utils.ExplodeUrl(e.endpoint.labelName, true);
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
            const depId = `${dep.endpoint.uniqueServiceName}\t${dep.endpoint.method}\t${dep.endpoint.labelName}`;
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
      uid: `${dep.endpoint.uniqueServiceName}\t${dep.endpoint.method}\t${dep.endpoint.labelName}`,
      sid: `${dep.endpoint.service}\t${dep.endpoint.namespace}`,
    }));

    nodes = nodes.map((n) => {
      switch (n.id) {
        case "null": // root node
          n.dependencies = dependencyWithId
            .filter((d) => d.dependBy.length === 0)
            .map(({ uid }) => uid);
          n.linkInBetween = n.dependencies.map((d) => ({
            source: "null",
            target: d,
          }));
          break;
        case n.group: // service node
          n.dependencies = dependencyWithId
            .filter((d) => d.sid === n.id)
            .map(({ uid }) => uid);
          n.linkInBetween = n.dependencies.map((d) => ({
            source: n.id,
            target: d,
          }));
          break;
        default:
          // endpoint node
          // find the node and sort dependsOn & dependBy with descending distance
          const node = dependencyWithId.find((d) => d.uid === n.id)!;
          const dependsOnSorted = this.sortEndpointInfoByDistanceDesc(
            node.dependsOn
          );
          const dependBySorted = this.sortEndpointInfoByDistanceDesc(
            node.dependBy
          );

          // fill in links to highlight
          n.linkInBetween = [
            ...this.mapToLinks(dependsOnSorted, n, links),
            ...this.mapToLinks(dependBySorted, n, links),
          ].filter((l) => !!l) as ILink[];
          // fill in nodes to highlight
          n.dependencies = [
            ...new Set([
              ...this.remapToId(dependsOnSorted),
              ...this.remapToId(dependBySorted),
            ]),
          ];
      }
      return n;
    });
    return { nodes, links };
  }
  private remapToId(list: TEndpointDependency[]) {
    return list.map(
      ({ endpoint: { uniqueServiceName, method, labelName } }) =>
        `${uniqueServiceName}\t${method}\t${labelName}`
    );
  }
  private sortEndpointInfoByDistanceDesc(list: TEndpointDependency[]) {
    return [...list].sort((a, b) => b.distance - a.distance);
  }
  private mapToLinks(list: TEndpointDependency[], node: INode, links: ILink[]) {
    return list
      .map(
        ({ endpoint: { uniqueServiceName, method, labelName }, type }, i) => {
          const id = `${uniqueServiceName}\t${method}\t${labelName}`;
          const remaining = new Set([
            ...this.remapToId(list.slice(i + 1)),
            node.id,
          ]);
          const from = type === "SERVER" ? "target" : "source";
          const to = type === "SERVER" ? "source" : "target";
          return links.filter((l) => l[from] === id && remaining.has(l[to]));
        }
      )
      .flat();
  }

  toServiceDependencies() {
    // gather all service info from endpointDependencies
    const serviceTemplates = [
      ...this._dependencies.reduce(
        (prev, { endpoint }) => prev.add(endpoint.uniqueServiceName),
        new Set<string>()
      ),
    ];

    // create service dependencies
    return serviceTemplates.map((uniqueName): IServiceDependency => {
      // find dependencies for the current service
      const dependency = this._dependencies.filter(
        ({ endpoint }) => endpoint.uniqueServiceName === uniqueName
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
            uniqueServiceName: uniqueName,
          };
        }),
        uniqueServiceName: uniqueName,
      };
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
        return {
          uniqueName: dep.endpoint.uniqueServiceName,
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

  toChordData() {
    const serviceMap = new Map<string, Map<string, number>>();
    this.dependencies.forEach((ep) => {
      const service = ep.endpoint.uniqueServiceName;
      if (!serviceMap.has(service)) serviceMap.set(service, new Map());
      ep.dependsOn.forEach((s) => {
        const dependName = s.endpoint.uniqueServiceName;
        serviceMap
          .get(service)!
          .set(dependName, (serviceMap.get(service)!.get(dependName) || 0) + 1);
      });
    });

    const nodes = [...serviceMap.keys()].map((k) => {
      const [service, namespace, version] = k.split("\t");
      return {
        id: `${service}.${namespace} (${version})`,
        name: k,
      };
    });
    const links = [...serviceMap.entries()]
      .map(([id, dep]) => {
        const [service, namespace, version] = id.split("\t");
        const neoId = `${service}.${namespace} (${version})`;
        return [...dep.entries()].map(([dId, val]) => {
          const [dService, dNamespace, dVersion] = dId.split("\t");
          const neoDId = `${dService}.${dNamespace} (${dVersion})`;
          return {
            from: neoId,
            to: neoDId,
            value: val,
          };
        });
      })
      .flat();
    return { nodes, links };
  }
}

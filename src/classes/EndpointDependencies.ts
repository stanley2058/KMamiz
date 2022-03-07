import {
  IEndpointDependency,
  TEndpointDependency,
} from "../entities/IEndpointDependency";
import IGraphData, { ILink, INode } from "../entities/IGraphData";
import IServiceDependency, {
  IServiceLinkInfo,
} from "../entities/IServiceDependency";
import DataCache from "../services/DataCache";

export class EndpointDependencies {
  private readonly _dependencies: IEndpointDependency[];
  constructor(dependencies: IEndpointDependency[]) {
    this._dependencies = dependencies;
  }

  get dependencies() {
    return this._dependencies;
  }

  trim() {
    return new EndpointDependencies(
      this._dependencies.map((d): IEndpointDependency => {
        const dOnMap = new Map<string, any>();
        d.dependsOn.forEach((dOn) => {
          const id = `${dOn.distance}\t${dOn.endpoint.uniqueEndpointName}`;
          dOnMap.set(id, dOn);
        });
        const dByMap = new Map<string, any>();
        d.dependBy.forEach((dBy) => {
          const id = `${dBy.distance}\t${dBy.endpoint.uniqueEndpointName}`;
          dByMap.set(id, dBy);
        });

        return {
          ...d,
          dependBy: [...dByMap.values()],
          dependsOn: [...dOnMap.values()],
        };
      })
    );
  }

  label() {
    return this._dependencies.map((d): IEndpointDependency => {
      const labelName = DataCache.getInstance().getLabelFromUniqueEndpointName(
        d.endpoint.uniqueEndpointName
      );

      const dependBy = d.dependBy.map((dep) => {
        return {
          ...dep,
          endpoint: {
            ...dep.endpoint,
            labelName: DataCache.getInstance().getLabelFromUniqueEndpointName(
              dep.endpoint.uniqueEndpointName
            ),
          },
        };
      });
      const dependsOn = d.dependsOn.map((dep) => {
        return {
          ...dep,
          endpoint: {
            ...dep.endpoint,
            labelName: DataCache.getInstance().getLabelFromUniqueEndpointName(
              dep.endpoint.uniqueEndpointName
            ),
          },
        };
      });

      return {
        endpoint: {
          ...d.endpoint,
          labelName,
        },
        dependsOn,
        dependBy,
      };
    });
  }

  toGraphData() {
    const serviceEndpointMap = new Map<string, IEndpointDependency[]>();
    const dependencies = this._dependencies;
    dependencies.forEach((dep) => {
      const uniqueName = `${dep.endpoint.service}\t${dep.endpoint.namespace}`;
      serviceEndpointMap.set(uniqueName, [
        ...(serviceEndpointMap.get(uniqueName) || []),
        dep,
      ]);
    });

    const { nodes: bNodes, links: bLinks } =
      this.createBaseNodesAndLinks(serviceEndpointMap);
    return this.createHighlightNodesAndLinks(
      dependencies,
      bNodes,
      bLinks
    ) as IGraphData;
  }

  private createBaseNodesAndLinks(
    serviceEndpointMap: Map<string, IEndpointDependency[]>
  ) {
    const existLabels = new Set<string>();
    const existLinks = new Set<string>();
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
        // endpoint node
        if (!existLabels.has(id)) {
          nodes.push({
            id,
            group: service,
            name: `(${e.endpoint.version}) ${e.endpoint.method} ${e.endpoint.labelName}`,
            dependencies: [],
            linkInBetween: [],
          });
          existLabels.add(id);
        }

        // service to endpoint links
        if (!existLinks.has(`${service}\t${id}`)) {
          links.push({
            source: service,
            target: id,
          });
          existLinks.add(`${service}\t${id}`);
        }

        // endpoint to endpoint links
        e.dependsOn
          .filter((dep) => dep.distance === 1)
          .forEach((dep) => {
            const depId = `${dep.endpoint.uniqueServiceName}\t${dep.endpoint.method}\t${dep.endpoint.labelName}`;
            if (!existLinks.has(`${id}\t${depId}`)) {
              links.push({
                source: id,
                target: depId,
              });
              existLinks.add(`${id}\t${depId}`);
            }
          });
        if (e.dependBy.length === 0) {
          if (!existLinks.has(`null\t${id}`)) {
            links.push({
              source: "null",
              target: id,
            });
            existLinks.add(`null\t${id}`);
          }
        }
      });
    });

    return { nodes, links };
  }
  private createHighlightNodesAndLinks(
    dependencies: IEndpointDependency[],
    nodes: INode[],
    links: ILink[]
  ) {
    const dependencyWithId = dependencies.map((dep) => ({
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
    const dependencies = this._dependencies;
    // gather all service info from endpointDependencies
    const serviceTemplates = [
      ...dependencies.reduce(
        (prev, { endpoint }) => prev.add(endpoint.uniqueServiceName),
        new Set<string>()
      ),
    ];

    // create service dependencies
    return serviceTemplates.map((uniqueServiceName): IServiceDependency => {
      // find dependencies for the current service
      const dependency = dependencies.filter(
        ({ endpoint }) => endpoint.uniqueServiceName === uniqueServiceName
      );

      // create links info from endpointDependencies
      const linkMap =
        EndpointDependencies.createServiceToLinksMapping(dependency);

      // combine all previous data to create a service dependency
      const [service, namespace, version] = uniqueServiceName.split("\t");
      return {
        service,
        namespace,
        version,
        dependency,
        links: Object.entries(linkMap).map(([uniqueServiceName, info]) => {
          const [service, namespace, version] = uniqueServiceName.split("\t");
          return {
            service,
            namespace,
            version,
            ...info,
            uniqueServiceName,
          };
        }),
        uniqueServiceName,
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
          uniqueName: dep.endpoint.labelName!,
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
    const dependencies = this._dependencies;
    const dependencyMap = new Map<string, IEndpointDependency>();
    dependencies.forEach((d) => {
      dependencyMap.set(d.endpoint.labelName!, d);
    });

    const serviceMap = new Map<string, Map<string, number>>();
    [...dependencyMap.values()].forEach((ep) => {
      const service = ep.endpoint.uniqueServiceName!;
      if (!serviceMap.has(service)) serviceMap.set(service, new Map());
      ep.dependsOn.forEach((s) => {
        const dependName = s.endpoint.uniqueServiceName!;
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

  combineWith(endpointDependencies: EndpointDependencies) {
    const dependencyMap = new Map<
      string,
      {
        endpoint: IEndpointDependency;
        dependBySet: Set<string>;
        dependsOnSet: Set<string>;
      }
    >();
    this._dependencies.forEach((d) => {
      dependencyMap.set(
        d.endpoint.uniqueEndpointName,
        this.createDependencyMapObject(d)
      );
    });
    endpointDependencies._dependencies.forEach((d) => {
      const existing = dependencyMap.get(d.endpoint.uniqueEndpointName);
      if (existing) {
        d.dependBy.forEach((dep) => {
          const id = `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`;
          if (!existing.dependBySet.has(id)) {
            existing.endpoint.dependBy.push(dep);
            existing.dependBySet.add(id);
          }
        });
        d.dependsOn.forEach((dep) => {
          const id = `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`;
          if (!existing.dependBySet.has(id)) {
            existing.endpoint.dependsOn.push(dep);
            existing.dependsOnSet.add(id);
          }
        });
      } else {
        dependencyMap.set(
          d.endpoint.uniqueEndpointName,
          this.createDependencyMapObject(d)
        );
      }
    });
    return new EndpointDependencies(
      [...dependencyMap.values()].map(({ endpoint }) => endpoint)
    );
  }
  private createDependencyMapObject(endpoint: IEndpointDependency): {
    endpoint: IEndpointDependency;
    dependBySet: Set<string>;
    dependsOnSet: Set<string>;
  } {
    return {
      endpoint,
      dependBySet: new Set(
        endpoint.dependBy.map(
          (dep) => `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`
        )
      ),
      dependsOnSet: new Set(
        endpoint.dependsOn.map(
          (dep) => `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`
        )
      ),
    };
  }
}

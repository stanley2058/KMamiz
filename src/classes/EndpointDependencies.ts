import {
  TEndpointDependency,
  TEndpointDependencyCombined,
} from "../entities/TEndpointDependency";
import { TGraphData, TLink, TNode } from "../entities/TGraphData";
import {
  TServiceDependency,
  TServiceLinkInfo,
} from "../entities/TServiceDependency";
import { TServiceEndpointCohesion } from "../entities/TServiceEndpointCohesion";
import DataCache from "../services/DataCache";
import RiskAnalyzer from "../utils/RiskAnalyzer";
import { CLabelMapping } from "./Cacheable/CLabelMapping";

export class EndpointDependencies {
  private readonly _dependencies: TEndpointDependency[];
  constructor(dependencies: TEndpointDependency[]) {
    this._dependencies = dependencies;
  }

  toJSON() {
    return this._dependencies.map((dep) => {
      if (dep._id) dep._id = undefined;
      dep.dependingBy = dep.dependingBy.map((d) => {
        delete (d as any)["_id"];
        return d;
      });
      dep.dependingOn = dep.dependingOn.map((d) => {
        delete (d as any)["_id"];
        return d;
      });
      return dep;
    });
  }

  trim() {
    return new EndpointDependencies(
      this._dependencies.map((d): TEndpointDependency => {
        const dOnMap = new Map<string, any>();
        d.dependingOn.forEach((dOn) => {
          const id = `${dOn.distance}\t${dOn.endpoint.uniqueEndpointName}`;
          dOnMap.set(id, dOn);
        });
        const dByMap = new Map<string, any>();
        d.dependingBy.forEach((dBy) => {
          const id = `${dBy.distance}\t${dBy.endpoint.uniqueEndpointName}`;
          dByMap.set(id, dBy);
        });

        return {
          ...d,
          dependingBy: [...dByMap.values()],
          dependingOn: [...dOnMap.values()],
        };
      })
    );
  }

  label() {
    return this._dependencies.map((d): TEndpointDependency => {
      const getEpName = (uniqueName: string) => {
        return DataCache.getInstance()
          .get<CLabelMapping>("LabelMapping")
          .getLabelFromUniqueEndpointName(uniqueName);
      };

      const labelName = getEpName(d.endpoint.uniqueEndpointName);
      const dependingBy = d.dependingBy.map((dep) => {
        return {
          ...dep,
          endpoint: {
            ...dep.endpoint,
            labelName: getEpName(dep.endpoint.uniqueEndpointName),
          },
        };
      });
      const dependingOn = d.dependingOn.map((dep) => {
        return {
          ...dep,
          endpoint: {
            ...dep.endpoint,
            labelName: getEpName(dep.endpoint.uniqueEndpointName),
          },
        };
      });

      return {
        endpoint: {
          ...d.endpoint,
          labelName,
        },
        dependingOn,
        dependingBy,
      };
    });
  }

  toGraphData() {
    const serviceEndpointMap = new Map<string, TEndpointDependency[]>();
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
    ) as TGraphData;
  }

  private createBaseNodesAndLinks(
    serviceEndpointMap: Map<string, TEndpointDependency[]>
  ) {
    const existLabels = new Set<string>();
    const existLinks = new Set<string>();
    const nodes: TNode[] = [
      // root node (external)
      {
        id: "null",
        group: "null",
        name: "external requests",
        dependencies: [],
        linkInBetween: [],
      },
    ];
    const links: TLink[] = [];
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
        e.dependingOn
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
        if (e.dependingBy.length === 0) {
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
    dependencies: TEndpointDependency[],
    nodes: TNode[],
    links: TLink[]
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
            .filter((d) => d.dependingBy.length === 0)
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
          // find the node and sort dependingOn & dependingBy with descending distance
          const node = dependencyWithId.find((d) => d.uid === n.id)!;
          const dependingOnSorted = this.sortEndpointInfoByDistanceDesc(
            node.dependingOn
          );
          const dependingBySorted = this.sortEndpointInfoByDistanceDesc(
            node.dependingBy
          );

          // fill in links to highlight
          n.linkInBetween = [
            ...this.mapToLinks(dependingOnSorted, n, links),
            ...this.mapToLinks(dependingBySorted, n, links),
          ].filter((l) => !!l) as TLink[];
          // fill in nodes to highlight
          n.dependencies = [
            ...new Set([
              ...this.remapToId(dependingOnSorted),
              ...this.remapToId(dependingBySorted),
            ]),
          ];
      }
      return n;
    });
    return { nodes, links };
  }
  private remapToId(list: TEndpointDependencyCombined[]) {
    return list.map(
      ({ endpoint: { uniqueServiceName, method, labelName } }) =>
        `${uniqueServiceName}\t${method}\t${labelName}`
    );
  }
  private sortEndpointInfoByDistanceDesc(list: TEndpointDependencyCombined[]) {
    return [...list].sort((a, b) => b.distance - a.distance);
  }
  private mapToLinks(
    list: TEndpointDependencyCombined[],
    node: TNode,
    links: TLink[]
  ) {
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
    return serviceTemplates.map((uniqueServiceName): TServiceDependency => {
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
    dependency: TEndpointDependency[]
  ) {
    // create links info from endpointDependencies
    const linkMap = dependency
      .map((dep) => [...dep.dependingOn, ...dep.dependingBy])
      .flat()
      .map((dep) => {
        return {
          uniqueServiceName: dep.endpoint.uniqueServiceName,
          distance: dep.distance,
          type: dep.type,
        };
      })
      .reduce((prev, { uniqueServiceName, distance, type }) => {
        if (!prev[uniqueServiceName]) {
          prev[uniqueServiceName] = {
            distance,
            count: 1,
            dependingBy: type === "CLIENT" ? 1 : 0,
            dependingOn: type === "SERVER" ? 1 : 0,
          };
        } else {
          prev[uniqueServiceName].count++;
          if (type === "CLIENT") prev[uniqueServiceName].dependingBy++;
          else prev[uniqueServiceName].dependingOn++;
        }
        return prev;
      }, {} as { [uniqueServiceName: string]: TServiceLinkInfo });
    return linkMap;
  }

  toChordData() {
    const dependencies = this._dependencies;
    const dependencyMap = new Map<string, TEndpointDependency>();
    dependencies.forEach((d) => {
      dependencyMap.set(d.endpoint.labelName!, d);
    });

    const serviceMap = new Map<string, Map<string, Set<string>>>();
    [...dependencyMap.values()].forEach((ep) => {
      const service = ep.endpoint.uniqueServiceName!;
      if (!serviceMap.has(service)) serviceMap.set(service, new Map());
      ep.dependingOn.forEach((s) => {
        const dependName = s.endpoint.uniqueServiceName!;
        const uniqueLabelName = `${s.endpoint.uniqueServiceName}\t${
          s.endpoint.method
        }\t${s.endpoint.labelName!}`;
        serviceMap
          .get(service)!
          .set(
            dependName,
            (serviceMap.get(service)!.get(dependName) || new Set()).add(
              uniqueLabelName
            )
          );
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
            value: val.size,
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
        endpoint: TEndpointDependency;
        dependingBySet: Set<string>;
        dependingOnSet: Set<string>;
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
        d.dependingBy.forEach((dep) => {
          const id = `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`;
          if (!existing.dependingBySet.has(id)) {
            existing.endpoint.dependingBy.push(dep);
            existing.dependingBySet.add(id);
          }
        });
        d.dependingOn.forEach((dep) => {
          const id = `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`;
          if (!existing.dependingBySet.has(id)) {
            existing.endpoint.dependingOn.push(dep);
            existing.dependingOnSet.add(id);
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
  private createDependencyMapObject(endpoint: TEndpointDependency): {
    endpoint: TEndpointDependency;
    dependingBySet: Set<string>;
    dependingOnSet: Set<string>;
  } {
    return {
      endpoint,
      dependingBySet: new Set(
        endpoint.dependingBy.map(
          (dep) => `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`
        )
      ),
      dependingOnSet: new Set(
        endpoint.dependingOn.map(
          (dep) => `${dep.endpoint.uniqueEndpointName}\t${dep.distance}`
        )
      ),
    };
  }

  toServiceEndpointCohesion() {
    const serviceEndpointMap = new Map<string, TEndpointDependency[]>();
    this._dependencies.forEach((d) => {
      const id = d.endpoint.uniqueServiceName;
      serviceEndpointMap.set(
        id,
        (serviceEndpointMap.get(id) || []).concat([d])
      );
    });

    return [...serviceEndpointMap.entries()].map(
      ([uniqueServiceName, endpoints]): TServiceEndpointCohesion => {
        const serviceUtilizedMap = endpoints
          .flatMap((e) =>
            e.dependingBy
              .filter((d) => d.distance === 1)
              .map((dep) => ({ e, dep }))
          )
          .reduce((map, { e, dep }) => {
            const id = dep.endpoint.uniqueServiceName;
            const source = e.endpoint.uniqueEndpointName;
            return map.set(id, (map.get(id) || new Set()).add(source));
          }, new Map<string, Set<string>>());

        const consumers = [...serviceUtilizedMap.entries()].map(
          ([uniqueServiceName, consumes]) => ({
            uniqueServiceName,
            consumes: consumes.size,
          })
        );

        let endpointUsageCohesion = 0;
        if (endpoints.length > 0 && consumers.length > 0) {
          endpointUsageCohesion = consumers.reduce((acc, cur) => {
            return acc + cur.consumes / endpoints.length;
          }, 0);
          endpointUsageCohesion /= consumers.length;
        }

        return {
          uniqueServiceName,
          totalEndpoints: endpoints.length,
          consumers,
          endpointUsageCohesion,
        };
      }
    );
  }

  toServiceInstability() {
    const serviceDependencies = this.toServiceDependencies();

    return serviceDependencies.map((s) => {
      const { dependingBy, dependingOn } = s.links.reduce(
        (acc, cur) => {
          if (cur.dependingBy > 0) acc.dependingBy++;
          if (cur.dependingOn > 0) acc.dependingOn++;
          return acc;
        },
        { dependingBy: 0, dependingOn: 0 }
      );

      return {
        uniqueServiceName: s.uniqueServiceName,
        name: `${s.service}.${s.namespace} (${s.version})`,
        dependingBy,
        dependingOn,
        instability: dependingOn / (dependingOn + dependingBy),
      };
    });
  }

  toServiceCoupling() {
    const serviceDependencies = this.toServiceDependencies();
    const couplingList =
      RiskAnalyzer.AbsoluteCriticalityOfServices(serviceDependencies);
    return couplingList.map((c) => {
      const [service, namespace, version] = c.uniqueServiceName.split("\t");
      return {
        uniqueServiceName: c.uniqueServiceName,
        name: `${service}.${namespace} (${version})`,
        ais: c.ais,
        ads: c.ads,
        acs: c.factor,
      };
    });
  }
}

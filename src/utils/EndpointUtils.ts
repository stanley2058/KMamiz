import EndpointDataType from "../classes/EndpointDataType";
import Utils from "./Utils";

export default class EndpointUtils {
  static CreateEndpointLabelMapping(
    dataTypes: EndpointDataType[],
    matchingThreshold = 0.5
  ) {
    const serviceMapping = new Map<string, EndpointDataType[]>();
    dataTypes.forEach((d) => {
      const s = d.toJSON().uniqueServiceName;
      serviceMapping.set(s, (serviceMapping.get(s) || []).concat([d]));
    });

    const groups: EndpointDataType[][] = [];
    [...serviceMapping.entries()].forEach(([_, endpoints]) => {
      const grouped = new Set<string>();
      endpoints.forEach((e) => {
        if (grouped.has(e.toJSON().uniqueEndpointName)) return;
        const group: EndpointDataType[] = endpoints.filter((ep) => {
          if (e.toJSON().method !== ep.toJSON().method) {
            return false;
          }

          const [, , , , baseUrl] = e.toJSON().uniqueEndpointName.split("\t");
          const [, , , , cmpUrl] = ep.toJSON().uniqueEndpointName.split("\t");
          const [, , basePath] = Utils.ExplodeUrl(baseUrl);
          const [, , cmpPath] = Utils.ExplodeUrl(cmpUrl);

          if (
            !EndpointUtils.hasExactAmountOfToken(basePath, cmpPath) ||
            !EndpointUtils.hasMatchingTokenOf(
              basePath,
              cmpPath,
              matchingThreshold
            )
          ) {
            return false;
          }

          return e.hasMatchedSchema(ep);
        });
        if (group.length > 0) groups.push(group);
        group.forEach((ep) => grouped.add(ep.toJSON().uniqueEndpointName));
      });
    });

    const labelMapping = new Map<string, string>();
    groups.forEach((group) => {
      const uniqueNames = group.map((e) => e.toJSON().uniqueEndpointName);
      const label = EndpointUtils.combineAndMaskUrls(
        uniqueNames.map((n) => {
          const [, , , , url] = n.split("\t");
          const [, , path] = Utils.ExplodeUrl(url);
          return path;
        })
      );
      uniqueNames.forEach((n) => {
        labelMapping.set(n, label);
      });
    });
    return labelMapping;
  }

  static GuessAndMergeEndpoints(
    uniqueNames: string[],
    labelMap: Map<string, string>
  ) {
    const labelToSampleMap = new Map<string, string>();
    [...labelMap.entries()].forEach(([key, val]) =>
      labelToSampleMap.set(val.replace(/\{[^\}]*\}/, "{}"), key)
    );
    const labelTree: any = {};
    [...labelMap.values()].forEach((l) => {
      const tokens = l
        .replace(/\{[^\}]*\}/, "{}")
        .split("/")
        .slice(1);
      let root = labelTree;
      tokens.forEach((tok) => {
        root[tok] = {
          ...root[tok],
        };
        root = root[tok];
      });
    });

    uniqueNames
      .filter((u) => !labelMap.has(u))
      .forEach((u) => {
        const [service, namespace, version, method, url] = u.split("\t");
        const uniqueServiceName = `${service}\t${namespace}\t${version}`;

        const [, , path] = Utils.ExplodeUrl(url);
        const tokens = path.split("/").slice(1);
        const visited: string[] = [];
        let root = labelTree;

        for (let tok of tokens) {
          if (!root[tok]) tok = "{}";
          if (!root[tok]) return;
          visited.push(tok);
          root = root[tok];
        }

        const label = `/${visited.join("/")}`;
        const sample = labelToSampleMap.get(label);
        if (sample && sample.startsWith(`${uniqueServiceName}\t${method}`)) {
          labelMap.set(u, labelMap.get(sample)!);
        }
      });
    return labelMap;
  }

  private static combineAndMaskUrls(urls: string[]) {
    const urlTable = urls.map((u) => u.split("/"));
    let masked = urlTable[0];
    let maskedPosition: Set<string>[] = [];
    for (let i = 1; i < urlTable.length; i++) {
      for (let j = 0; j < masked.length; j++) {
        if (masked[j] !== urlTable[i][j]) {
          if (!maskedPosition[j]) maskedPosition[j] = new Set([masked[j]]);
          maskedPosition[j].add(urlTable[i][j]);
          masked[j] = "{}";
        }
      }
    }

    for (let i = 0; i < masked.length; i++) {
      if (masked[i] !== "{}") continue;
      if (maskedPosition[i].size > 5) continue;
      const partialMask = `{${[...maskedPosition[i]]
        .map((m) => (m || "").trim())
        .filter((m) => !!m)
        .join(",")}}`;
      if (partialMask.length <= 20) masked[i] = partialMask;
    }

    return masked.join("/");
  }

  private static hasExactAmountOfToken(pathA: string, pathB: string) {
    return pathA.split("/").length === pathB.split("/").length;
  }

  private static hasMatchingTokenOf(
    pathA: string,
    pathB: string,
    percentage: number
  ) {
    const tokA = pathA.split("/");
    const tokB = pathB.split("/");
    const len = (tokA.length > tokB.length ? tokB : tokA).length;

    let equalTokCount = 0;
    for (let i = 0; i < len; i++) {
      if (tokA[i] === tokB[i]) equalTokCount++;
    }
    return equalTokCount / len > percentage;
  }
}

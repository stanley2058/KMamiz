import EndpointDataType from "../classes/EndpointDataType";
import Utils from "./Utils";

export default class EndpointUtils {
  static CreateEndpointLabelMapping(dataTypes: EndpointDataType[]) {
    const serviceMapping = new Map<string, EndpointDataType[]>();
    dataTypes.forEach((d) => {
      const s = d.endpointDataType.uniqueServiceName;
      serviceMapping.set(s, (serviceMapping.get(s) || []).concat([d]));
    });

    const groups: EndpointDataType[][] = [];
    [...serviceMapping.entries()].forEach(([_, endpoints]) => {
      const grouped = new Set<string>();
      endpoints.forEach((e) => {
        if (grouped.has(e.endpointDataType.uniqueEndpointName)) return;
        const group: EndpointDataType[] = endpoints.filter((ep) => {
          if (e.endpointDataType.method !== ep.endpointDataType.method) {
            return false;
          }

          const [, , , , baseUrl] =
            e.endpointDataType.uniqueEndpointName.split("\t");
          const [, , , , cmpUrl] =
            ep.endpointDataType.uniqueEndpointName.split("\t");
          const [, , basePath] = Utils.ExplodeUrl(baseUrl);
          const [, , cmpPath] = Utils.ExplodeUrl(cmpUrl);

          if (!EndpointUtils.hasExactAmountOfToken(basePath, cmpPath)) {
            return false;
          }

          return e.hasMatchedSchema(ep);
        });
        if (group.length > 0) groups.push(group);
        group.forEach((ep) =>
          grouped.add(ep.endpointDataType.uniqueEndpointName)
        );
      });
    });

    const labelMapping = new Map<string, string>();
    groups.forEach((group) => {
      const uniqueNames = group.map(
        (e) => e.endpointDataType.uniqueEndpointName
      );
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
}

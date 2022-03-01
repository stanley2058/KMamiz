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
          if (e.endpointDataType.method !== ep.endpointDataType.method)
            return false;
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
    for (let i = 1; i < urlTable.length; i++) {
      for (let j = 0; j < masked.length; j++) {
        if (masked[j] !== "{}" && masked[j] !== urlTable[i][j]) {
          masked[j] = "{}";
        }
      }
    }
    return masked.join("/");
  }
}

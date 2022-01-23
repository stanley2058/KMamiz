import JsonToTS from "json-to-ts";
import Logger from "./Logger";

export default class Utils {
  static ObjectToInterfaceString(object: any, name: string = "Root") {
    const sortObject = (obj: any) =>
      Object.keys(obj)
        .sort()
        .reduce((prev, curr) => {
          let o = obj[curr];
          if (typeof o === "object") {
            if (Array.isArray(o) && o.length > 0 && typeof o[0] === "object") {
              o = o.map((o) => sortObject(o));
            } else if (!Array.isArray(o)) o = sortObject(o);
          }
          prev[curr] = o;
          return prev;
        }, {} as any);
    return JsonToTS(sortObject(object), { rootName: name }).join("\n");
  }

  /**
   * Explode url into meaningful parts
   * @param url url to explode
   * @param isServiceUrl if is a Kubernetes service url
   * @returns [host, port, path, serviceName, namespace, clusterName]
   */
  static ExplodeUrl(url: string, isServiceUrl = false) {
    if (url.search(/[a-z]+:\/\//) === -1) url = `://${url}`;
    let returnArray = [];
    const [, host, port, path] = url.match(/:\/\/([^:/]*)([:0-9]*)(.*)/) || [];
    returnArray.push(host, port, path);
    if (isServiceUrl) {
      const [, serviceFullName, clusterName] =
        host.match(/(.*).svc.(.*)/) || [];
      if (!serviceFullName) {
        Logger.warn("Could not parse service url: [", url, "], skipping.");
        Logger.plain.verbose("With trace:", new Error().stack);
      } else {
        const nameDivider = serviceFullName.lastIndexOf(".");
        const serviceName = serviceFullName.slice(0, nameDivider);
        const namespace = serviceFullName.slice(nameDivider + 1);
        returnArray.push(serviceName, namespace, clusterName);
      }
    }
    return returnArray;
  }

  /**
   * Get timestamp of 00:00 of the same day as the given timestamp
   * @param timestamp timestamp in microseconds
   * @returns the timestamp of the day in microseconds
   */
  static BelongsToDateTimestamp(timestamp: number) {
    return new Date(new Date(timestamp).toLocaleDateString()).getTime();
  }
}

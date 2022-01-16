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

  static NormalizeNumbers(
    input: number[],
    strategy: (input: number[]) => number[]
  ) {
    return strategy(input);
  }
  static readonly NormalizeStrategy = {
    /**
     * Format to [0.1 ~ 1]
     * @param input
     * @returns Array of number between 0.1 and 1
     */
    BetweenFixedNumber(input: number[]) {
      const baseLine = 0.1;
      const ratio = 1 - baseLine;
      const max = Math.max(...input);
      const min = Math.min(...input);
      if (max - min === 0) return input;
      return input.map(
        (value) => ((value - min) / (max - min)) * ratio + baseLine
      );
    },
    /**
     * Sigmoid function
     * @param input
     * @returns Array of number between 0 and 1
     */
    Sigmoid(input: number[]) {
      return input.map((value) => 1 / (1 + Math.exp(-value)));
    },
    /**
     * Divide by max value
     * @param input
     * @returns Array of number between 0 and 1
     */
    FixedRatio(input: number[]) {
      const max = Math.max(...input);
      if (max === 0) return input;
      return input.map((value) => value / max);
    },
  };
}

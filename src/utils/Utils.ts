import JsonToTS from "json-to-ts";

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
            } else o = sortObject(o);
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
      const nameDivider = serviceFullName.lastIndexOf(".");
      const serviceName = serviceFullName.slice(0, nameDivider);
      const namespace = serviceFullName.slice(nameDivider + 1);
      returnArray.push(serviceName, namespace, clusterName);
    }
    return returnArray;
  }

  static NormalizeNumbers(
    input: number[],
    strategy: (input: number[]) => number[]
  ) {
    return strategy(input);
  }
  static readonly NormalizeStrategy = {
    BetweenFixedNumber(input: number[]) {
      // format to [0.1 ~ 1]
      const baseLine = 0.1;
      const ratio = 1 - baseLine;
      const max = Math.max(...input);
      const min = Math.min(...input);
      return input.map(
        (value) => ((value - min) / (max - min)) * ratio + baseLine
      );
    },
    Sigmoid(input: number[]) {
      return input.map((value) => 1 / (1 + Math.exp(-value)));
    },
  };
}

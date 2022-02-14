import JsonToTS from "json-to-ts";
import Logger from "./Logger";

export default class Utils {
  /**
   * Craft a Typescript interface from an object or an array of objects
   * @param object Object or Array of Objects
   * @param name (Optional) Override the root interface name
   * @returns Typescript interface in string form, primitives will be translated into their types
   */
  static ObjectToInterfaceString(object: any, name: string = "Root") {
    if (this.isPrimitive(object)) return typeof object;
    const sorted = this.sortObject(object);
    const primitivePart = this.primitiveInterface(object);
    let objPart = null;
    if (
      (sorted && !Array.isArray(sorted)) ||
      (Array.isArray(sorted) && sorted.length > 0)
    ) {
      objPart = JsonToTS(sorted, { rootName: name }).join("\n");
    }
    return (objPart || "") + (primitivePart || "");
  }
  private static primitiveInterface(obj: any): any {
    if (!Array.isArray(obj)) return null;
    const primitivePart = obj.filter(this.isPrimitive).map((o) => typeof o);
    if (primitivePart.length === 0) return null;
    return `[\n${[...new Set(primitivePart)]
      .map((t) => `  ${t}`)
      .join(",\n")}\n]`;
  }
  private static sortObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .filter((o) => !this.isPrimitive(o))
        .map((o) => this.sortObject(o));
    }

    return Object.keys(obj)
      .sort()
      .reduce((prev, curr) => {
        let o = obj[curr];
        if (typeof o === "object") {
          if (Array.isArray(o) && o.length > 0 && typeof o[0] === "object") {
            o = o.map((o) => (o ? this.sortObject(o) : null));
          } else if (!Array.isArray(o)) o = o ? this.sortObject(o) : null;
        }
        prev[curr] = o;
        return prev;
      }, {} as any);
  }
  private static isPrimitive(obj: any) {
    return obj !== Object(obj);
  }

  /**
   * Explode url into meaningful parts
   * @param url url to explode
   * @param isServiceUrl if is a Kubernetes service url, default: false
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

  /**
   * Calculate the score of Cosine Similarity between two interface string
   * @param interfaceA An interface string
   * @param interfaceB An interface string
   * @returns Score between 0 and 1
   * @see https://en.wikipedia.org/wiki/Cosine_similarity
   */
  static InterfaceCosineSimilarity(interfaceA: string, interfaceB: string) {
    const setA = this.matchInterfaceFieldAndTrim(interfaceA);
    const setB = this.matchInterfaceFieldAndTrim(interfaceB);
    const baseSet = [...new Set<string>([...setA, ...setB])].sort();
    const vectorA = this.createStandardVector(baseSet, setA);
    const vectorB = this.createStandardVector(baseSet, setB);
    return vectorA.reduce((score, curr, i) => score + curr * vectorB[i], 0);
  }
  private static matchInterfaceFieldAndTrim(interfaceStr: string) {
    return new Set(
      [...(interfaceStr.match(/^[ ]+([^{}\n])*/gm) || [])].map((s) => s.trim())
    );
  }
  private static vectorMagnitude(vector: number[]) {
    return Math.sqrt(vector.reduce((acc, cur) => acc + Math.pow(cur, 2), 0));
  }
  private static createStandardVector(base: string[], vector: Set<string>) {
    const v: number[] = base.map((l) => (vector.has(l) ? 1 : 0));
    const m = this.vectorMagnitude(v);
    return v.map((val) => (m ? val / m : 0));
  }
}

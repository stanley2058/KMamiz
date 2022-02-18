import JsonToTS from "json-to-ts";
import Logger from "./Logger";

interface Test {}

export default class Utils {
  /**
   * Craft a Typescript interface from an object or an array of objects
   * @param object Object or Array of Objects
   * @param name (Optional) Override the root interface name
   * @returns Typescript interface in string form, primitives will be translated into their types
   */
  static ObjectToInterfaceString(object: any, name: string = "Root"): string {
    if (this.isPrimitive(object)) return typeof object;
    const sorted = this.sortObject(object);
    if (Array.isArray(sorted)) {
      let arrayType = "Array<any>{}";
      let appending = "";
      if (object.length > 0) {
        if (this.isPrimitive(object[0])) {
          arrayType = `Array<${typeof object[0]}>{}`;
        } else {
          arrayType = "Array<ArrayItem>{}\n";
          appending = JsonToTS(sorted, { rootName: "ArrayItem" }).join("\n");
        }
      }
      return `interface ${name} extends ${arrayType}${appending}`;
    }
    const primitivePart = this.primitiveInterface(object);
    let objPart = null;
    if (sorted && !Array.isArray(sorted)) {
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
    return this.cosSim(vectorA, vectorB);
  }
  private static matchInterfaceFieldAndTrim(interfaceStr: string) {
    const fields = new Set(
      [
        ...(interfaceStr.match(/^[ ]+([^{}\n])*/gm) || []),
        ...(interfaceStr.match(/extends (Array<[^>]*>)/g) || []),
      ].map((s) => s.trim())
    );
    return fields;
  }
  private static vectorMagnitude(vector: number[]) {
    return Math.sqrt(vector.reduce((acc, cur) => acc + Math.pow(cur, 2), 0));
  }
  private static createStandardVector(base: string[], vector: Set<string>) {
    const v: number[] = base.map((l) => (vector.has(l) ? 1 : 0));
    const m = this.vectorMagnitude(v);
    return v.map((val) => (m ? val / m : 0));
  }
  private static cosSim(vectorA: number[], vectorB: number[]) {
    return vectorA.reduce((score, curr, i) => score + curr * vectorB[i], 0);
  }

  /**
   * (Experimental) Extract endpoints from request records and request bodies
   *
   * Switch to using this with extra caution if Zipkin doesn't work
   * @param urls All request urls from a service
   * @param body Bodies of paired request url
   * @returns Guessed API endpoints
   * @experimental
   */
  static ExtractPathPatternWithBody(urls: string[], body: string[]) {
    if (urls.length === 0 || body.length === 0 || urls.length !== body.length) {
      return null;
    }
    const bodyToUrlMap = new Map<string, string[]>();
    body.forEach((b, i) => {
      bodyToUrlMap.set(b, [...(bodyToUrlMap.get(b) || []), urls[i]]);
    });
    const urlMapping = new Map<string, string>();
    [...bodyToUrlMap.entries()].forEach(([, candidates]) => {
      const grouped = this.findEndpoints(candidates);
      grouped.forEach((g) => {
        const masked = this.combineAndMaskUrls([...g]).join("/");
        g.forEach((u) => urlMapping.set(u, masked));
      });
    });
    return urlMapping;
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
    return masked;
  }
  private static findEndpoints(urls: string[], threshold = 0.5) {
    const grouped = new Map<string, Set<string>>();
    const setUrls = new Set<string>();
    const base = [...new Set(urls.map((u) => u.split("/")).flat())];

    for (let i = 0; i < urls.length; i++) {
      if (setUrls.has(urls[i])) continue;
      if (!grouped.has(urls[i]))
        grouped.set(urls[i], new Set<string>([urls[i]]));
      setUrls.add(urls[i]);
      const curSet = new Set(urls[i].split("/"));
      const curVec = this.createStandardVector(base, curSet);
      for (let j = i + 1; j < urls.length; j++) {
        const cmpSet = new Set(urls[j].split("/"));
        const score = this.cosSim(
          curVec,
          this.createStandardVector(base, cmpSet)
        );
        if (score >= threshold) {
          setUrls.add(urls[j]);
          grouped.get(urls[i])!.add(urls[j]);
        }
      }
    }
    return [...grouped.values()];
  }
}

import { Axios, AxiosRequestConfig, AxiosResponse } from "axios";
import JsonToTS from "json-to-ts";
import { inspect } from "util";
import { TEndpointRequestParam } from "../entities/TEndpointDataType";
import Logger from "./Logger";

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
        host.match(/(.*).svc[\.]*(.*)/) || [];
      if (!serviceFullName) {
        Logger.verbose("Could not parse service url: [", url, "], skipping.");
        Logger.plain.verbose("With trace:", new Error().stack);
      } else {
        const nameDivider = serviceFullName.lastIndexOf(".");
        const serviceName = serviceFullName.slice(0, nameDivider);
        const namespace = serviceFullName.slice(nameDivider + 1);
        returnArray.push(
          serviceName,
          namespace,
          clusterName || "cluster.local"
        );
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
    const dateStr = new Date(timestamp).toISOString().split("T")[0];
    return new Date(`${dateStr}T00:00:00.000Z`).getTime();
  }

  /**
   * Calculate the score of Cosine Similarity between two interface string
   * @param interfaceA An interface string
   * @param interfaceB An interface string
   * @returns Score between 0 and 1
   * @see https://en.wikipedia.org/wiki/Cosine_similarity
   */
  static InterfaceCosineSimilarity(interfaceA: string, interfaceB: string) {
    const setA = this.MatchInterfaceFieldAndTrim(interfaceA);
    const setB = this.MatchInterfaceFieldAndTrim(interfaceB);
    const baseSet = [...new Set<string>([...setA, ...setB])].sort();
    const vectorA = this.CreateStandardVector(baseSet, setA);
    const vectorB = this.CreateStandardVector(baseSet, setB);
    return this.CosSim(vectorA, vectorB);
  }
  static MatchInterfaceFieldAndTrim(interfaceStr: string) {
    const fields = new Set(
      [
        ...(interfaceStr.match(/^[ ]+([^{}\n])*/gm) || []),
        ...(interfaceStr.match(/extends (Array<[^>]*>)/g) || []),
      ].map((s) => s.trim())
    );
    return fields;
  }
  static CreateStandardVector(base: string[], vector: Set<string>) {
    const v: number[] = base.map((l) => (vector.has(l) ? 1 : 0));
    const m = this.vectorMagnitude(v);
    return v.map((val) => (m ? val / m : 0));
  }
  private static vectorMagnitude(vector: number[]) {
    return Math.sqrt(vector.reduce((acc, cur) => acc + Math.pow(cur, 2), 0));
  }
  static CosSim(vectorA: number[], vectorB: number[]) {
    return vectorA.reduce((score, curr, i) => score + curr * vectorB[i], 0);
  }

  /**
   * Use Axios to send request, handles and logs error
   * @param client Axios client
   * @param method Http request method
   * @param url Request url
   * @param configs (Optional) Request config
   * @returns Axios response, null if error
   */
  static async AxiosRequest<ReturnType>(
    client: Axios,
    method: "get" | "post" | "delete" | "put" | "head" | "patch" | "options",
    url: string,
    configs?: AxiosRequestConfig<any>
  ): Promise<AxiosResponse<ReturnType, any> | null> {
    try {
      return await client[method](url, configs);
    } catch (err) {
      Logger.error("Error sending request");
      Logger.error("", err);
      return null;
    }
  }

  /**
   * Map any object to an OpenAPI compliant object description.
   * @param o Any object
   * @returns Object type description based on OpenAPI specification
   */
  static MapObjectToOpenAPITypes(o: any): any {
    if (Array.isArray(o)) {
      let itemTypes = undefined;
      if (o.length > 0) {
        itemTypes = this.isPrimitive(o[0])
          ? { type: typeof o[0] }
          : this.MapObjectToOpenAPITypes(
              o.reduce((prev, curr) => this.Merge(prev, curr), {})
            );
      }
      return {
        type: "array",
        items: itemTypes || { type: "object" },
        example: itemTypes ? undefined : [],
      };
    }
    if (!o) return { type: "object", nullable: true };
    return {
      type: "object",
      properties: Object.keys(o).reduce((prev, k) => {
        let type = typeof o[k];
        if (type === "object") {
          if (Array.isArray(o[k])) prev[k] = this.MapObjectToOpenAPITypes(o[k]);
          else prev[k] = this.MapObjectToOpenAPITypes(o[k]);
        } else prev[k] = { type };
        return prev;
      }, {} as any),
    };
  }

  /**
   * Get GET parameters from an url
   * @param url Any url
   * @returns Pairs of GET parameters, undefined if nothing were matched
   */
  static GetParamsFromUrl(url: string) {
    const matched = url
      .match(/([?&][^?&]*)/g)
      ?.map((r) => r.match(/[?&]([^=]*)=([^?&]*)/))
      .map((r) => r?.slice(1))
      .filter((r) => !!r) as string[][] | undefined;

    if (!matched) return undefined;
    const mapped = matched.map(([param, val]) => ({
      param,
      type: Number.isFinite(parseFloat(val)) ? "number" : "string",
    }));
    return this.UniqueParams(mapped);
  }

  /**
   * Remove duplicate parameters
   * @param parameters GET parameters
   * @returns Unique GET parameters
   */
  static UniqueParams(parameters: TEndpointRequestParam[]) {
    return Object.values(
      parameters.reduce((prev, { param, type }) => {
        if (prev[param] && type !== prev[param].type) type = "string";
        prev[param] = {
          param: prev[param]?.param || param,
          type,
        };
        return prev;
      }, {} as { [param: string]: TEndpointRequestParam })
    );
  }

  static Inspect(obj: any) {
    return inspect(obj, false, null, true);
  }

  static Merge(a: any, b: any) {
    if (Array.isArray(a) && Array.isArray(b)) return Utils.MergeArray(a, b);
    if (!Array.isArray(a) && !Array.isArray(b)) return Utils.MergeObject(a, b);
    return a || b;
  }

  static MergeObject(a: any, b: any) {
    return { ...a, ...b };
  }

  static MergeArray(a: any[], b: any[], limit = 10) {
    return [...a.slice(0, limit), ...b.slice(0, limit)];
  }

  static MergeStringBody(a?: string, b?: string) {
    if (a && b) {
      let parsedA: any;
      let parsedB: any;
      try {
        parsedA = JSON.parse(a);
      } catch (err) {}
      try {
        parsedB = JSON.parse(b);
      } catch (err) {}
      if (parsedA && parsedB) {
        return JSON.stringify(Utils.Merge(parsedA, parsedB));
      }
      return JSON.stringify(parsedA || parsedB);
    }
    return a || b;
  }

  static ToPrecise(num: number) {
    return Math.round((num + Number.EPSILON) * 1e14) / 1e14;
  }
}

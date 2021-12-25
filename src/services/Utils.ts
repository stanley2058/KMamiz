import JsonToTS from "json-to-ts";

export default class Utils {
  static GetInterfaceFromObject(object: any, name: string = "Root") {
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
}

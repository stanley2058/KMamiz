import { TAggregatedData } from "../../entities/TAggregatedData";
import { TEndpointLabel } from "../../entities/TEndpointLabel";
import { THistoricalData } from "../../entities/THistoricalData";
import EndpointUtils from "../../utils/EndpointUtils";
import Utils from "../../utils/Utils";
import EndpointDataType from "../EndpointDataType";
import { EndpointDependencies } from "../EndpointDependencies";
import { Cacheable } from "./Cacheable";

export class CLabelMapping extends Cacheable<Map<string, string>> {
  static readonly uniqueName = "LabelMapping";
  constructor(initData?: [string, string][]) {
    const map = new Map<string, string>();
    if (initData) initData.forEach(([ep, label]) => map.set(ep, label));
    super("LabelMapping", initData && map);
  }

  setData(
    update: Map<string, string>,
    userDefinedLabels?: TEndpointLabel,
    endpointDependencies?: EndpointDependencies
  ): void {
    const uniqueNames = new Set<string>();
    if (userDefinedLabels) {
      const reversedMap = new Map<string, Set<string>>();
      update.forEach((v, k) =>
        reversedMap.set(v, (reversedMap.get(v) || new Set()).add(k))
      );
      userDefinedLabels.labels
        .filter((l) => l.block)
        .flatMap((l) => {
          const endpoints = [...(reversedMap.get(l.label) || new Set())];
          return endpoints.filter((e) =>
            e.startsWith(`${l.uniqueServiceName}\t${l.method}`)
          );
        })
        .forEach((l) => {
          uniqueNames.add(l);
          update.delete(l);
        });
    }

    if (endpointDependencies) {
      endpointDependencies
        .toJSON()
        .flatMap((d) => [...d.dependingBy, ...d.dependingOn, d])
        .forEach((e) => uniqueNames.add(e.endpoint.uniqueEndpointName));
    }

    if (uniqueNames.size > 0) {
      update = EndpointUtils.GuessAndMergeEndpoints([...uniqueNames], update);
    }
    super.setData(update);
  }

  labelHistoricalData(historicalData: THistoricalData[]) {
    const labelMap = this.getData();
    if (!labelMap) return historicalData;
    const uniqueNames = new Set(
      historicalData
        .flatMap((h) => h.services)
        .flatMap((s) => s.endpoints)
        .flatMap((e) => e.uniqueEndpointName)
    );
    this.setData(
      EndpointUtils.GuessAndMergeEndpoints([...uniqueNames], labelMap)
    );

    historicalData.forEach((h) => {
      h.services.forEach((s) => {
        s.endpoints.forEach((e) => {
          e.labelName = this.getLabelFromUniqueEndpointName(
            e.uniqueEndpointName
          );
        });
      });
    });
    return historicalData;
  }

  labelAggregatedData(aggregatedData: TAggregatedData) {
    const labelMap = this.getData();
    if (!labelMap) return aggregatedData;
    const uniqueNames = new Set(
      aggregatedData.services
        .flatMap((s) => s.endpoints)
        .flatMap((e) => e.uniqueEndpointName)
    );
    this.setData(
      EndpointUtils.GuessAndMergeEndpoints([...uniqueNames], labelMap)
    );

    aggregatedData.services.forEach((s) => {
      s.endpoints.forEach((e) => {
        e.labelName = this.getLabelFromUniqueEndpointName(e.uniqueEndpointName);
      });
    });
    return aggregatedData;
  }

  getEndpointDataTypesByLabel(
    label: string,
    uniqueServiceName: string,
    method: string,
    endpointDataType: EndpointDataType[]
  ) {
    const filtered = endpointDataType.filter((dt) => {
      const raw = dt.toJSON();
      return (
        raw.uniqueServiceName === uniqueServiceName && raw.method === method
      );
    });
    const result = filtered.filter((dt) => {
      return (
        this.getLabelFromUniqueEndpointName(dt.toJSON().uniqueEndpointName) ===
        label
      );
    });
    return result;
  }

  getLabelFromUniqueEndpointName(uniqueName: string) {
    const labelMap = this.getData();
    const label = labelMap?.get(uniqueName);
    if (label) return label;
    const [, , , , url] = uniqueName.split("\t");
    const [, , path] = Utils.ExplodeUrl(url);
    return path;
  }

  getEndpointsFromLabel(label: string) {
    const labelMap = this.getData();
    if (!labelMap) return [];
    const map = new Map<string, string[]>();
    [...labelMap.entries()].forEach(([name, l]) => {
      map.set(l, (map.get(l) || []).concat([name]));
    });
    return map.get(label) || [];
  }

  toJSON() {
    const data = this.getData();
    if (!data) return [];
    return [...data.entries()];
  }
}

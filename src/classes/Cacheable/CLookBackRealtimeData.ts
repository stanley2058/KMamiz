import MongoOperator from "../../services/MongoOperator";
import ServiceOperator from "../../services/ServiceOperator";
import CombinedRealtimeDataList from "../CombinedRealtimeDataList";
import { HistoricalData } from "../HistoricalData";
import { Cacheable } from "./Cacheable";

export class CLookBackRealtimeData extends Cacheable<
  Map<number, CombinedRealtimeDataList>
> {
  readonly canExport = false;
  static readonly uniqueName = "LookBackRealtimeData";
  constructor(initData?: [number, CombinedRealtimeDataList][]) {
    const map = new Map<number, CombinedRealtimeDataList>();
    if (initData) initData.forEach(([ts, data]) => map.set(ts, data));
    super("LookBackRealtimeData", initData && map);
    this.setInit(async () => {
      const historicalData =
        await MongoOperator.getInstance().getHistoricalData(
          undefined,
          ServiceOperator.RISK_LOOK_BACK_TIME
        );
      const map = new Map<number, CombinedRealtimeDataList>();
      historicalData.forEach((h) => {
        map.set(
          h.date.getTime(),
          new HistoricalData(h).toCombinedRealtimeDataList()
        );
      });
      this.setData(map);
    });
  }

  setData(update: Map<number, CombinedRealtimeDataList>): void {
    const existing = super.getData() || new Map();
    [...update.entries()].forEach(([k, v]) => existing.set(k, v));
    super.setData(existing);
  }

  getData(): Map<number, CombinedRealtimeDataList> {
    const data = super.getData();
    if (!data) return new Map();
    const filtered = [...data.entries()]
      .filter(([ts]) => Date.now() - ts < ServiceOperator.RISK_LOOK_BACK_TIME)
      .reduce((prev, [ts, data]) => {
        prev.set(ts, data);
        return prev;
      }, new Map<number, CombinedRealtimeDataList>());

    super.setData(filtered);
    return filtered;
  }
}

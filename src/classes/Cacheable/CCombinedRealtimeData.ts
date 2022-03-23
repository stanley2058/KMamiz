import MongoOperator from "../../services/MongoOperator";
import CombinedRealtimeDataList from "../CombinedRealtimeDataList";
import { Cacheable } from "./Cacheable";

export class CCombinedRealtimeData extends Cacheable<CombinedRealtimeDataList> {
  constructor(initData?: CombinedRealtimeDataList) {
    super("CombinedRealtimeData", initData);
    this.setInit(async () => {
      this.setData(
        await MongoOperator.getInstance().getAllCombinedRealtimeData()
      );
    });
  }

  setData(update: CombinedRealtimeDataList): void {
    const data = super.getData();
    super.setData(data ? data.combineWith(update) : update);
  }

  getData(namespace?: string): CombinedRealtimeDataList | undefined {
    const data = super.getData();
    if (namespace && data) {
      return new CombinedRealtimeDataList(
        data.toJSON().filter((d) => d.namespace === namespace)
      );
    }
    return data;
  }
}

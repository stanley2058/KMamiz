import { CombinedRealtimeDataModel } from "../../entities/schema/CombinedRealtimeDateSchema";
import { TCombinedRealtimeData } from "../../entities/TCombinedRealtimeData";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import CombinedRealtimeDataList from "../CombinedRealtimeDataList";
import { Cacheable } from "./Cacheable";

export class CCombinedRealtimeData extends Cacheable<CombinedRealtimeDataList> {
  static readonly uniqueName = "CombinedRealtimeData";
  constructor(initData?: TCombinedRealtimeData[]) {
    super(
      "CombinedRealtimeData",
      initData && new CombinedRealtimeDataList(initData)
    );
    this.setInit(async () => {
      this.setData(
        new CombinedRealtimeDataList(
          await MongoOperator.getInstance().findAll(CombinedRealtimeDataModel)
        )
      );
    });
    this.setSync(async () => {
      const rlData = this.getData();
      const rlDataToDelete = await MongoOperator.getInstance().findAll(
        CombinedRealtimeDataModel
      );

      if (rlData) {
        try {
          const combinedRealtimeData = rlData.toJSON();
          await MongoOperator.getInstance().insertMany(
            combinedRealtimeData,
            CombinedRealtimeDataModel
          );
          await MongoOperator.getInstance().delete(
            rlDataToDelete.map((d) => d._id!),
            CombinedRealtimeDataModel
          );
        } catch (ex) {
          Logger.error(`Error saving ${this.name}, skipping.`);
          Logger.verbose("", ex);
        }
      }
    });
  }

  setData(update: CombinedRealtimeDataList): void {
    const data = super.getData();
    super.setData(data ? data.combineWith(update) : update);
  }

  reset() {
    super.clear();
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

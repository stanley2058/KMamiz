import { TaggedInterfaceModel } from "../../entities/schema/TaggedInterface";
import { TTaggedInterface } from "../../entities/TTaggedInterface";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import { Cacheable } from "./Cacheable";

export class CTaggedInterfaces extends Cacheable<TTaggedInterface[]> {
  static readonly uniqueName = "TaggedInterfaces";
  constructor(initData?: TTaggedInterface[]) {
    super("TaggedInterfaces", initData);
    this.setInit(async () => {
      this.setData(
        await MongoOperator.getInstance().findAll(TaggedInterfaceModel)
      );
    });
    this.setSync(async () => {
      const tagged = this.getData();
      const toDelete = await MongoOperator.getInstance().findAll(
        TaggedInterfaceModel
      );

      try {
        await MongoOperator.getInstance().insertMany(
          tagged,
          TaggedInterfaceModel
        );
        await MongoOperator.getInstance().delete(
          toDelete.map((t) => t._id!),
          TaggedInterfaceModel
        );
      } catch (ex) {
        Logger.error(`Error saving ${this.name}, skipping.`);
        Logger.verbose("", ex);
      }
    });
  }

  getData(uniqueLabelName?: string): TTaggedInterface[] {
    const data = super.getData();
    if (uniqueLabelName && data) {
      return data?.filter((i) => i.uniqueLabelName === uniqueLabelName) || [];
    }
    return data || [];
  }

  add(tagged: TTaggedInterface) {
    const data = this.getData();
    tagged.timestamp = Date.now();
    this.setData(data.concat([tagged]));
  }

  delete(uniqueLabelName: string, userLabel: string) {
    this.setData(
      this.getData().filter(
        (i) =>
          i.uniqueLabelName !== uniqueLabelName && i.userLabel !== userLabel
      )
    );
  }
}

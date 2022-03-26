import { TaggedSwaggerModel } from "../../entities/schema/TaggedSwagger";
import { TTaggedSwagger } from "../../entities/TTaggedSwagger";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import { Cacheable } from "./Cacheable";

export class CTaggedSwaggers extends Cacheable<TTaggedSwagger[]> {
  static readonly uniqueName = "TaggedSwaggers";
  constructor(initData?: TTaggedSwagger[]) {
    super("TaggedSwaggers", initData);
    this.setInit(async () => {
      this.setData(
        await MongoOperator.getInstance().findAll(TaggedSwaggerModel)
      );
    });
    this.setSync(async () => {
      const tagged = this.getData();
      const toDelete = await MongoOperator.getInstance().findAll(
        TaggedSwaggerModel
      );

      try {
        await MongoOperator.getInstance().insertMany(
          tagged,
          TaggedSwaggerModel
        );
        await MongoOperator.getInstance().delete(
          toDelete.map((t) => t._id!),
          TaggedSwaggerModel
        );
      } catch (ex) {
        Logger.error(`Error saving ${this.name}, skipping.`);
        Logger.verbose("", ex);
      }
    });
  }

  getData(uniqueServiceName?: string, tag?: string): TTaggedSwagger[] {
    const data = super.getData();
    if (!data || !uniqueServiceName) return data || [];
    const serviceDocs = data.filter(
      (d) => d.uniqueServiceName === uniqueServiceName
    );
    if (!tag) return serviceDocs;
    return serviceDocs.filter((d) => d.tag === tag);
  }

  add(tagged: TTaggedSwagger) {
    const existing = this.getData(tagged.uniqueServiceName, tagged.tag);
    if (existing.length > 0) return;
    tagged.time = Date.now();
    const data = this.getData();
    this.setData(data.concat(tagged));
  }

  delete(uniqueServiceName: string, tag: string) {
    const data = this.getData();
    this.setData(
      data.filter(
        (d) => d.tag !== tag || d.uniqueServiceName !== uniqueServiceName
      )
    );
  }
}

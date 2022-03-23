import { TTaggedInterface } from "../../entities/TTaggedInterface";
import { Cacheable } from "./Cacheable";

export class CTaggedInterfaces extends Cacheable<TTaggedInterface[]> {
  constructor(initData?: TTaggedInterface[]) {
    super("TaggedInterfaces", initData);
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

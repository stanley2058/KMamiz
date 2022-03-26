import { EndpointLabelModel } from "../../entities/schema/EndpointLabel";
import { TEndpointLabel } from "../../entities/TEndpointLabel";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import { Cacheable } from "./Cacheable";

export class CUserDefinedLabel extends Cacheable<TEndpointLabel> {
  static readonly uniqueName = "UserDefinedLabel";
  constructor(initData?: TEndpointLabel) {
    super("UserDefinedLabel", initData);
    this.setInit(async () => {
      this.setData(
        (await MongoOperator.getInstance().findAll(EndpointLabelModel))[0]
      );
    });
    this.setSync(async () => {
      const labels = this.getData();
      const toDelete = await MongoOperator.getInstance().findAll(
        EndpointLabelModel
      );

      if (labels) {
        try {
          await MongoOperator.getInstance().insertMany(
            [labels],
            EndpointLabelModel
          );
          await MongoOperator.getInstance().delete(
            toDelete.map((t) => t._id!),
            EndpointLabelModel
          );
        } catch (ex) {
          Logger.error(`Error saving ${this.name}, skipping.`);
          Logger.verbose("", ex);
        }
      }
    });
  }

  update(label: TEndpointLabel) {
    label.labels.forEach((l) =>
      this.delete(l.label, l.uniqueServiceName, l.method)
    );
    this.add(label);
  }

  add(label: TEndpointLabel) {
    const data = this.getData();
    this.setData({
      labels: (data?.labels || []).concat(label.labels),
    });
  }

  delete(labelName: string, uniqueServiceName: string, method: string) {
    const data = this.getData();
    if (!data) return;
    this.setData({
      labels: data.labels.filter(
        (l) =>
          l.label !== labelName ||
          l.uniqueServiceName !== uniqueServiceName ||
          l.method !== method
      ),
    });
  }
}

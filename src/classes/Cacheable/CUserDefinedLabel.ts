import { TEndpointLabel } from "../../entities/TEndpointLabel";
import { Cacheable } from "./Cacheable";

export class CUserDefinedLabel extends Cacheable<TEndpointLabel> {
  constructor(initData?: TEndpointLabel) {
    super("UserDefinedLabel", initData);
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

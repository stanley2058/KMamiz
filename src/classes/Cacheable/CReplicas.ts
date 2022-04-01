import { TReplicaCount } from "../../entities/TReplicaCount";
import GlobalSettings from "../../GlobalSettings";
import KubernetesService from "../../services/KubernetesService";
import { Cacheable } from "./Cacheable";

export class CReplicas extends Cacheable<TReplicaCount[]> {
  static readonly uniqueName = "ReplicaCounts";
  constructor(initData?: TReplicaCount[]) {
    super("ReplicaCounts", initData);
    this.setInit(async () => {
      if (GlobalSettings.ReadOnlyMode) return;
      this.setData(await KubernetesService.getInstance().getReplicas());
    });
  }

  setData(update: TReplicaCount[]): void {
    super.setData(update.filter((r) => !!r.service));
  }
}

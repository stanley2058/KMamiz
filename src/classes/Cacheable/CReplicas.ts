import { TReplicaCount } from "../../entities/TReplicaCount";
import GlobalSettings from "../../GlobalSettings";
import KubernetesService from "../../services/KubernetesService";
import { Cacheable } from "./Cacheable";

export class CReplicas extends Cacheable<TReplicaCount[]> {
  constructor(initData?: TReplicaCount[]) {
    super("ReplicaCounts", initData);
    this.setInit(async () => {
      if (GlobalSettings.ReadOnlyMode) return;
      this.setData(await KubernetesService.getInstance().getReplicas());
    });
  }
}

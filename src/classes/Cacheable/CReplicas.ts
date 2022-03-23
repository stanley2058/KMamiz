import { TReplicaCount } from "../../entities/TReplicaCount";
import KubernetesService from "../../services/KubernetesService";
import { Cacheable } from "./Cacheable";

export class CReplicas extends Cacheable<TReplicaCount[]> {
  constructor(initData?: TReplicaCount[]) {
    super("ReplicaCounts", initData);
    this.setInit(async () => {
      this.setData(await KubernetesService.getInstance().getReplicas());
    });
  }
}

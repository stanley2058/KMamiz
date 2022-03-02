import { RealtimeData } from "../classes/RealtimeData";
import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  async sync() {
    const rlData =
      DataCache.getInstance().realtimeDataSnap?.realtimeData.filter(
        (r) => !r._id
      );

    const dataTypes = DataCache.getInstance().endpointDataTypeSnap;
    const dependencies = DataCache.getInstance().getEndpointDependenciesSnap();

    await MongoOperator.getInstance().saveEndpointDataTypes(dataTypes);
    if (rlData) {
      await MongoOperator.getInstance().saveRealtimeData(
        new RealtimeData(rlData)
      );
    }
    if (dependencies) {
      await MongoOperator.getInstance().saveEndpointDependencies(dependencies);
    }
  }
}

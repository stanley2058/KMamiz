import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}

  async sync() {
    let rlData = DataCache.getInstance().combinedRealtimeDataSnap;
    let dataTypes = DataCache.getInstance().endpointDataTypeSnap;
    let dependencies = DataCache.getInstance().getEndpointDependenciesSnap();

    await MongoOperator.getInstance().deleteAllEndpointDataType();
    await MongoOperator.getInstance().insertEndpointDataTypes(dataTypes);
    if (rlData) {
      await MongoOperator.getInstance().deleteAllCombinedRealtimeData();
      await MongoOperator.getInstance().insertCombinedRealtimeData(rlData);
    }
    if (dependencies) {
      await MongoOperator.getInstance().deleteAllEndpointDependencies();
      await MongoOperator.getInstance().saveEndpointDependencies(dependencies);
    }
  }
}

import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}
  private _lock: boolean = false;

  async sync() {
    if (DispatchStorage.getInstance()._lock)
      return await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;

    let rlData = DataCache.getInstance().combinedRealtimeDataSnap;
    let dataTypes = DataCache.getInstance().endpointDataTypeSnap;
    let dependencies = DataCache.getInstance().getEndpointDependenciesSnap();

    await MongoOperator.getInstance().deleteAllEndpointDataType();
    await MongoOperator.getInstance().insertEndpointDataTypes(dataTypes);
    await MongoOperator.getInstance().deleteAllCombinedRealtimeData();
    if (rlData) {
      await MongoOperator.getInstance().insertCombinedRealtimeData(rlData);
    }
    await MongoOperator.getInstance().deleteAllEndpointDependencies();
    if (dependencies) {
      await MongoOperator.getInstance().saveEndpointDependencies(dependencies);
    }

    DispatchStorage.getInstance()._lock = false;
  }

  waitUntilUnlock() {
    return new Promise<void>((res) => {
      const timer = setInterval(() => {
        if (!DispatchStorage.getInstance()._lock) {
          clearInterval(timer);
          res();
        }
      }, 500);
    });
  }
}

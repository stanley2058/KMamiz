import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}
  private _lock: boolean = false;

  async sync() {
    if (this._lock) return await this.waitUntilUnlock();
    this._lock = true;

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

    this._lock = false;
  }

  waitUntilUnlock() {
    return new Promise<void>((res) => {
      const timer = setInterval(() => {
        if (!this._lock) {
          clearInterval(timer);
          res();
        }
      }, 500);
    });
  }
}

import Logger from "../utils/Logger";
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

    const rlData = DataCache.getInstance().combinedRealtimeDataSnap;
    const dataTypes = DataCache.getInstance().endpointDataTypeSnap;
    const dependencies =
      DataCache.getInstance().getRawEndpointDependenciesSnap();

    const dataTypesToDelete =
      await MongoOperator.getInstance().getAllEndpointDataTypes();
    const { combinedRealtimeData: rlDataToDelete } =
      await MongoOperator.getInstance().getAllCombinedRealtimeData();
    const { dependencies: dependenciesToDelete } =
      await MongoOperator.getInstance().getEndpointDependencies();

    try {
      await MongoOperator.getInstance().insertEndpointDataTypes(dataTypes);
      await MongoOperator.getInstance().deleteEndpointDataType(
        dataTypesToDelete.map((d) => d.endpointDataType._id!)
      );
    } catch (ex) {
      Logger.error("Error saving EndpointDataType, skipping.");
      Logger.verbose("", ex);
    }

    if (rlData) {
      try {
        await MongoOperator.getInstance().insertCombinedRealtimeData(rlData);
        await MongoOperator.getInstance().deleteCombinedRealtimeData(
          rlDataToDelete.map((d) => d._id!)
        );
      } catch (ex) {
        Logger.error("Error saving CombinedRealtimeData, skipping.");
        Logger.verbose("", ex);
      }
    }

    if (dependencies) {
      try {
        await MongoOperator.getInstance().insertEndpointDependencies(
          dependencies
        );
        await MongoOperator.getInstance().deleteEndpointDependencies(
          dependenciesToDelete.map((d) => d._id!)
        );
      } catch (ex) {
        Logger.error("Error saving EndpointDependencies, skipping.");
        Logger.verbose("", ex);
      }
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

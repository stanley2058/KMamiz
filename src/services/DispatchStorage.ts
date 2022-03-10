import Logger from "../utils/Logger";
import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}
  private _lock: boolean = false;
  private syncType = 0;

  async sync() {
    if (DispatchStorage.getInstance()._lock)
      return await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;

    switch (DispatchStorage.getInstance().syncType) {
      case 0:
        Logger.verbose("Dispatch syncing type: CombinedRealtimeData");
        await DispatchStorage.getInstance().syncCombinedRealtimeData();
        break;
      case 1:
        Logger.verbose("Dispatch syncing type: EndpointDataType");
        await DispatchStorage.getInstance().syncEndpointDataType();
        break;
      case 2:
        Logger.verbose("Dispatch syncing type: EndpointDependencies");
        await DispatchStorage.getInstance().syncEndpointDependencies();
        break;
    }

    DispatchStorage.getInstance().syncType =
      (DispatchStorage.getInstance().syncType + 1) % 3;
    DispatchStorage.getInstance()._lock = false;
  }

  async syncAll() {
    await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;

    await DispatchStorage.getInstance().syncCombinedRealtimeData();
    await DispatchStorage.getInstance().syncEndpointDataType();
    await DispatchStorage.getInstance().syncEndpointDependencies();

    DispatchStorage.getInstance()._lock = false;
  }

  private async syncCombinedRealtimeData() {
    const rlData = DataCache.getInstance().combinedRealtimeDataSnap;
    const { combinedRealtimeData: rlDataToDelete } =
      await MongoOperator.getInstance().getAllCombinedRealtimeData();

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
  }

  private async syncEndpointDataType() {
    const dataTypes = DataCache.getInstance().endpointDataTypeSnap;
    const dataTypesToDelete =
      await MongoOperator.getInstance().getAllEndpointDataTypes();

    try {
      await MongoOperator.getInstance().insertEndpointDataTypes(dataTypes);
      await MongoOperator.getInstance().deleteEndpointDataType(
        dataTypesToDelete.map((d) => d.endpointDataType._id!)
      );
    } catch (ex) {
      Logger.error("Error saving EndpointDataType, skipping.");
      Logger.verbose("", ex);
    }
  }

  private async syncEndpointDependencies() {
    const dependencies =
      DataCache.getInstance().getRawEndpointDependenciesSnap();
    const { dependencies: dependenciesToDelete } =
      await MongoOperator.getInstance().getEndpointDependencies();

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

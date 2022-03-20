import Logger from "../utils/Logger";
import DataCache from "./DataCache";
import MongoOperator from "./MongoOperator";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private constructor() {}
  private _lock: boolean = false;
  private syncType = 0;
  private syncStrategies: { name: string; syncFunc: () => Promise<void> }[] = [
    {
      name: "CombinedRealtimeData",
      syncFunc: DispatchStorage.getInstance().syncCombinedRealtimeData,
    },
    {
      name: "EndpointDataType",
      syncFunc: DispatchStorage.getInstance().syncEndpointDataType,
    },
    {
      name: "EndpointDependencies",
      syncFunc: DispatchStorage.getInstance().syncEndpointDependencies,
    },
    {
      name: "EndpointLabelMap",
      syncFunc: DispatchStorage.getInstance().syncEndpointLabelMap,
    },
  ];

  async sync() {
    if (DispatchStorage.getInstance()._lock)
      return await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;

    const index = DispatchStorage.getInstance().syncType;
    const sync = DispatchStorage.getInstance().syncStrategies[index];

    Logger.verbose(`Dispatch syncing type: ${sync.name}`);
    await sync.syncFunc();

    DispatchStorage.getInstance().nextSyncType();
    DispatchStorage.getInstance()._lock = false;
  }

  async syncAll() {
    await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;

    for (const sync of DispatchStorage.getInstance().syncStrategies) {
      await sync.syncFunc();
    }

    DispatchStorage.getInstance()._lock = false;
  }

  private nextSyncType() {
    const current = DispatchStorage.getInstance().syncType;
    const total = DispatchStorage.getInstance().syncStrategies.length;
    DispatchStorage.getInstance().syncType = (current + 1) % total;
  }

  private async syncCombinedRealtimeData() {
    const rlData = DataCache.getInstance().combinedRealtimeDataSnap;
    const rlDataToDelete = (
      await MongoOperator.getInstance().getAllCombinedRealtimeData()
    ).toJSON();

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
        dataTypesToDelete.map((d) => d.toJSON()._id!)
      );
    } catch (ex) {
      Logger.error("Error saving EndpointDataType, skipping.");
      Logger.verbose("", ex);
    }
  }

  private async syncEndpointDependencies() {
    const dependencies =
      DataCache.getInstance().getRawEndpointDependenciesSnap();
    const dependenciesToDelete = (
      await MongoOperator.getInstance().getEndpointDependencies()
    ).toJSON();

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

  private async syncEndpointLabelMap() {
    const toDelete = await MongoOperator.getInstance().getEndpointLabelMap();
    const labelMap = DataCache.getInstance().userDefinedLabels;

    try {
      if (labelMap) {
        await MongoOperator.getInstance().insertEndpointLabelMap(labelMap);
        if (toDelete && toDelete._id) {
          await MongoOperator.getInstance().deleteEndpointLabel([toDelete._id]);
        }
      }
    } catch (ex) {
      Logger.error("Error saving EndpointLabelMap, skipping.");
      Logger.verbose("", ex);
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

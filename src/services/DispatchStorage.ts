import Logger from "../utils/Logger";
import DataCache from "./DataCache";

export default class DispatchStorage {
  private static instance?: DispatchStorage;
  static getInstance = () => this.instance || (this.instance = new this());
  private _lock: boolean = false;
  private syncType = 0;

  private constructor() {}

  get syncStrategies() {
    return [...DataCache.getInstance().getAll().entries()]
      .filter(([, cache]) => !!cache.sync)
      .sort(([aName], [bName]) => aName.localeCompare(bName))
      .map(([name, cache]) => {
        return {
          name,
          syncFunc: cache.sync!,
        };
      });
  }

  async sync() {
    if (DispatchStorage.getInstance()._lock)
      return await DispatchStorage.getInstance().waitUntilUnlock();
    DispatchStorage.getInstance()._lock = true;
    DispatchStorage.getInstance().nextSyncType();

    const index = DispatchStorage.getInstance().syncType;
    const sync = DispatchStorage.getInstance().syncStrategies[index];

    Logger.verbose(`Dispatch syncing type: ${sync.name}`);
    await sync.syncFunc();

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

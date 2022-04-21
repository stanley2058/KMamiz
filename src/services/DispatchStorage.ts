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
    if (this._lock) return await this.waitUntilUnlock();
    this._lock = true;
    this.nextSyncType();

    const index = this.syncType;
    const sync = this.syncStrategies[index];

    Logger.verbose(`Dispatch syncing type: ${sync.name}`);
    await sync.syncFunc();

    this._lock = false;
  }

  async syncAll() {
    await this.waitUntilUnlock();
    this._lock = true;
    Logger.info("Syncing all caches to database");

    for (const sync of this.syncStrategies) {
      await sync.syncFunc();
    }

    this._lock = false;
  }

  private nextSyncType() {
    const current = this.syncType;
    const total = this.syncStrategies.length;
    this.syncType = (current + 1) % total;
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

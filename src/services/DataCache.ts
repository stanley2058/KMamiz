import { CacheableNames } from "../classes/Cacheable";
import { Cacheable } from "../classes/Cacheable/Cacheable";
import Logger from "../utils/Logger";

export default class DataCache {
  private static instance?: DataCache;
  static getInstance = () => this.instance || (this.instance = new this());

  private _caches: Cacheable<any>[];
  private _cacheMap: Map<CacheableNames, Cacheable<any>>;

  private constructor() {
    this._caches = [];
    this._cacheMap = new Map();
  }

  /**
   * Register caches
   * @param caches A list of Cacheable, order matters
   */
  register(caches: Cacheable<any>[]) {
    this._caches = caches;
    caches.forEach((c) => {
      this._cacheMap.set(c.name as CacheableNames, c);
    });
  }

  getAll(): Map<CacheableNames, Cacheable<any>> {
    return this._cacheMap;
  }

  get<T extends Cacheable<any>>(name: CacheableNames): T {
    return this._cacheMap.get(name)! as T;
  }

  async loadBaseData() {
    const promises: Promise<any>[] = [];
    this._caches.forEach((c) => {
      if (c.init) {
        Logger.verbose(`Loading ${c.name} into cache.`);
        promises.push(c.init());
      }
    });

    for (const promise of promises) await promise;
  }
}

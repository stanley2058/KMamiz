export abstract class Cacheable<T> {
  private readonly _name: string;
  private _data?: T;
  private _init?: () => Promise<void>;
  private _sync?: () => Promise<void>;

  constructor(name: string, initData?: T) {
    this._name = name;
    this._data = initData;
  }

  get name() {
    return this._name;
  }

  getData(...arg: any[]) {
    return this._data;
  }

  setData(update: T, ...arg: any[]) {
    this._data = update;
  }

  get init() {
    return this._init;
  }
  get sync() {
    return this._sync;
  }

  protected setInit(f: () => Promise<void>) {
    this._init = f;
  }
  protected setSync(f: () => Promise<void>) {
    this._sync = f;
  }

  protected clear() {
    this._data = undefined;
  }

  toJSON() {
    const hasCustom = (this._data as any)?.toJSON;
    const custom = hasCustom && (this._data as any).toJSON();
    return custom || this._data;
  }
}

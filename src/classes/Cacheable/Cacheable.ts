export abstract class Cacheable<T> {
  private readonly _name: string;
  private _data?: T;
  private _init?: () => Promise<void>;
  private _sync?: () => Promise<void>;
  private _lastUpdate: number;
  readonly canExport: boolean = true;

  constructor(name: string, initData?: T) {
    this._name = name;
    this._data = initData;
    this._lastUpdate = Date.now();
  }

  get name() {
    return this._name;
  }

  // @ts-ignore
  getData(...arg: any[]) {
    return this._data;
  }

  // @ts-ignore
  setData(update: T, ...arg: any[]) {
    this.updateTime();
    this._data = update;
  }

  get init() {
    return this._init;
  }
  get sync() {
    return this._sync;
  }

  get lastUpdate() {
    return this._lastUpdate;
  }

  protected setInit(f: () => Promise<void>) {
    this._init = f;
  }
  protected setSync(f: () => Promise<void>) {
    this._sync = f;
  }

  protected clear() {
    this.updateTime();
    this._data = undefined;
  }

  private updateTime() {
    this._lastUpdate = Date.now();
  }

  toJSON() {
    const hasCustom = (this._data as any)?.toJSON;
    const custom = hasCustom && (this._data as any).toJSON();
    return custom || this._data;
  }
}

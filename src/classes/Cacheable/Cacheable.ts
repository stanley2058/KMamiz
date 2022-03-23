export abstract class Cacheable<T> {
  private readonly _name: string;
  private _data?: T;
  private _init?: () => Promise<void>;

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

  protected setInit(f: () => Promise<void>) {
    this._init = f;
  }

  call(funcName: string, ...args: any[]) {
    const f = (this as any)[funcName];
    if (f) f(args);
  }

  toJSON() {
    const f = (this._data as any).toJSON;
    return f ? f() : this._data;
  }
}

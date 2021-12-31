export default class DependencyService {
  private static instance?: DependencyService;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {}

  async createSnapshot() {}

  async getAccumulatedDependencies() {}
}

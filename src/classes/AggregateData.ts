import IAggregateData from "../entities/IAggregateData";

export class AggregateData {
  private readonly _aggregateData: IAggregateData;
  constructor(aggregateData: IAggregateData) {
    this._aggregateData = aggregateData;
  }
  get aggregateData() {
    return this._aggregateData;
  }

  combine(aggData: IAggregateData) {
    const fromDate =
      this._aggregateData.fromDate < aggData.fromDate
        ? this._aggregateData.fromDate
        : aggData.fromDate;
    const toDate =
      this._aggregateData.toDate > aggData.toDate
        ? this._aggregateData.toDate
        : aggData.toDate;

    const currentData = this._aggregateData.services.map((s) => ({
      ...s,
      uniqueName: `${s.name}\t${s.namespace}\t${s.version}`,
    }));
    const newData = aggData.services.map((s) => ({
      ...s,
      uniqueName: `${s.name}\t${s.namespace}\t${s.version}`,
    }));

    const sumData = currentData.map((s) => {
      const newS = newData.find(
        ({ uniqueName }) => uniqueName === s.uniqueName
      );

      if (!newS) return s;
      const totalRequests = s.totalRequests + newS.totalRequests;
      const avgRisk =
        (s.totalRequests / totalRequests) * s.avgRisk +
        (newS.totalRequests / totalRequests) * newS.avgRisk;
      return {
        name: s.name,
        namespace: s.namespace,
        version: s.version,
        totalRequests,
        totalServerErrors: s.totalServerErrors + newS.totalServerErrors,
        totalRequestErrors: s.totalRequestErrors + newS.totalRequestErrors,
        avgRisk,
        uniqueName: s.uniqueName,
      };
    });
    const currentSet = new Set(sumData.map(({ uniqueName }) => uniqueName));
    sumData.push(
      ...newData.filter(({ uniqueName }) => !currentSet.has(uniqueName))
    );

    return new AggregateData({
      fromDate,
      toDate,
      services: sumData.map(
        ({
          name,
          version,
          namespace,
          totalRequestErrors,
          totalRequests,
          totalServerErrors,
          avgRisk,
        }) => ({
          name,
          version,
          namespace,
          totalRequestErrors,
          totalRequests,
          totalServerErrors,
          avgRisk,
        })
      ),
    });
  }
}

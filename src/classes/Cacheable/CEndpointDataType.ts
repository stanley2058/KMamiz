import MongoOperator from "../../services/MongoOperator";
import EndpointDataType from "../EndpointDataType";
import { Cacheable } from "./Cacheable";

export class CEndpointDataType extends Cacheable<EndpointDataType[]> {
  constructor(initData?: EndpointDataType[]) {
    super("EndpointDataType", initData);
    this.setInit(async () => {
      this.setData(await MongoOperator.getInstance().getAllEndpointDataTypes());
    });
  }

  setData(update: EndpointDataType[]): void {
    const data = super.getData();
    if (data) {
      const dataTypeMap = new Map<string, EndpointDataType>();
      data.forEach((d) => {
        dataTypeMap.set(d.toJSON().uniqueEndpointName, d);
      });

      update.forEach((d) => {
        const id = d.toJSON().uniqueEndpointName;
        const existing = dataTypeMap.get(id);
        dataTypeMap.set(id, existing ? existing.mergeSchemaWith(d) : d);
      });

      update = [...dataTypeMap.values()];
    }
    super.setData(update.map((t) => t.trim()));
  }
}

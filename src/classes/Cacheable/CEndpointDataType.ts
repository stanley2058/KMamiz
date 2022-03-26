import { EndpointDataTypeModel } from "../../entities/schema/EndpointDataTypeSchema";
import MongoOperator from "../../services/MongoOperator";
import Logger from "../../utils/Logger";
import EndpointDataType from "../EndpointDataType";
import { Cacheable } from "./Cacheable";

export class CEndpointDataType extends Cacheable<EndpointDataType[]> {
  static readonly uniqueName = "EndpointDataType";
  constructor(initData?: EndpointDataType[]) {
    super("EndpointDataType", initData);
    this.setInit(async () => {
      this.setData(
        (await MongoOperator.getInstance().findAll(EndpointDataTypeModel)).map(
          (r) => new EndpointDataType(r)
        )
      );
    });
    this.setSync(async () => {
      const dataTypes = this.getData();
      const dataTypesToDelete = (
        await EndpointDataTypeModel.find({}).exec()
      ).map((r) => new EndpointDataType(r.toObject()));

      try {
        await MongoOperator.getInstance().insertMany(
          dataTypes.map((e) => e.toJSON()),
          EndpointDataTypeModel
        );
        await MongoOperator.getInstance().delete(
          dataTypesToDelete.map((d) => d.toJSON()._id!),
          EndpointDataTypeModel
        );
      } catch (ex) {
        Logger.error(`Error saving ${this.name}, skipping.`);
        Logger.verbose("", ex);
      }
    });
  }

  getData() {
    return super.getData() || [];
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

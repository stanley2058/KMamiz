import CombinedRealtimeDataList from "../src/classes/CombinedRealtimeDataList";
import EndpointDataType from "../src/classes/EndpointDataType";
import { TEndpointDataType } from "../src/entities/TEndpointDataType";
import {
  MockBaseCrlData1,
  MockBaseCrlData2,
  MockEndpointDataType,
} from "./MockData";
import Utils from "../src/utils/Utils";

describe("EndpointDataType", () => {
  it("trim duplicated data", () => {
    const dataType: TEndpointDataType = { ...MockEndpointDataType[0] };
    dataType.schemas = [...dataType.schemas, ...dataType.schemas];
    expect(new EndpointDataType(dataType).trim().toJSON()).toEqual(
      MockEndpointDataType[0]
    );
  });

  it("check if schema matches", () => {
    const dataType1 = new CombinedRealtimeDataList(
      MockBaseCrlData1
    ).extractEndpointDataType()[0];
    const dataType2 = new CombinedRealtimeDataList(
      MockBaseCrlData2
    ).extractEndpointDataType()[0];

    expect(dataType1.hasMatchedSchema(dataType2)).toEqual(true);
  });

  it("merges schemas", () => {
    const dataType1: TEndpointDataType = MockEndpointDataType[0];
    const dataType2 = { ...dataType1 };
    dataType2.schemas[0] = {
      ...dataType2.schemas[0],
      responseSample: { name: "string", id: 0 },
      responseSchema: Utils.ObjectToInterfaceString({ name: "string", id: 0 }),
    };

    const merged = new EndpointDataType(dataType1).mergeSchemaWith(
      new EndpointDataType(dataType2)
    );
    expect(merged.toJSON().schemas[0].responseSchema).toEqual(
      "interface Root {\n  id: number;\n  name: string;\n}"
    );
  });

  it("get service cohesion", () => {
    const dataType1 = new CombinedRealtimeDataList(
      MockBaseCrlData1
    ).extractEndpointDataType()[0];
    const dataType2 = new CombinedRealtimeDataList(
      MockBaseCrlData2
    ).extractEndpointDataType()[0];
    expect(
      EndpointDataType.GetServiceCohesion([dataType1, dataType2]).length
    ).toEqual(1);
  });
});

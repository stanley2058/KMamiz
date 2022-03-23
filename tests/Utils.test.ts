import Normalizer from "../src/utils/Normalizer";
import Utils from "../src/utils/Utils";

describe("Utils", () => {
  it("create interface string from object", () => {
    const obj = {
      testNumber: 123,
      testString: "test",
      testArray: [1, 2, 3],
      testObjArray: [{ test: 123, text: "test" }],
      testObj: {
        test: 1.1,
        text: "test",
      },
    };
    const interfaceString = Utils.ObjectToInterfaceString(obj, "Test");
    expect(interfaceString).toEqual(
      "interface Test {\n" +
        "  testArray: number[];\n" +
        "  testNumber: number;\n" +
        "  testObj: TestObj;\n" +
        "  testObjArray: TestObj[];\n" +
        "  testString: string;\n" +
        "}\n" +
        "interface TestObj {\n" +
        "  test: number;\n" +
        "  text: string;\n" +
        "}"
    );

    const array = [
      {
        id: "61d58fabd7cb2766e01db3c6",
        originId: null,
        ordinaryUserName: null,
        dataRequesterName: "新創公司A",
        dataHolderName: "台灣電力公司",
        firstSignDate: 0,
        secondSignDate: 0,
        signState: 0,
      },
      {
        id: "61d58facd7cb2766e01db7b0",
        originId: null,
        ordinaryUserName: null,
        dataRequesterName: "新創公司A",
        dataHolderName: "台灣電力公司",
        firstSignDate: 0,
        secondSignDate: 0,
        signState: -3,
      },
    ];
    const arrayInterfaceString = Utils.ObjectToInterfaceString(
      array,
      "ObjArray"
    );
    expect(arrayInterfaceString).toEqual(
      "interface ObjArray extends Array<ArrayItem>{}\n" +
        "interface ArrayItem {\n" +
        "  dataHolderName: string;\n" +
        "  dataRequesterName: string;\n" +
        "  firstSignDate: number;\n" +
        "  id: string;\n" +
        "  ordinaryUserName?: any;\n" +
        "  originId?: any;\n" +
        "  secondSignDate: number;\n" +
        "  signState: number;\n" +
        "}"
    );
  });

  it("explode url into sections", () => {
    const url1 = "http://example.com:8080/test/test";
    const url2 = "https://192.168.1.1/test#123";
    const url3 = "service.test.svc.cluster.local:80/test/endpoint";
    expect(Utils.ExplodeUrl(url1).join("\t")).toEqual(
      "example.com\t:8080\t/test/test"
    );
    expect(Utils.ExplodeUrl(url2).join("\t")).toEqual(
      "192.168.1.1\t\t/test#123"
    );
    expect(Utils.ExplodeUrl(url3).join("\t")).toEqual(
      "service.test.svc.cluster.local\t:80\t/test/endpoint"
    );
  });

  it("get timestamp of 00:00 of the same day as the given timestamp", () => {
    const timestamp = new Date().getTime();
    expect(Utils.BelongsToDateTimestamp(timestamp)).toEqual(
      new Date(new Date(timestamp).toLocaleDateString()).getTime()
    );
  });

  it("normalize numbers", () => {
    const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));
    const input = [1, 2, 3];
    expect(
      Normalizer.Numbers(input, Normalizer.Strategy.BetweenFixedNumber)
    ).toEqual([0.1, 0.55, 1]);

    expect(Normalizer.Numbers(input, Normalizer.Strategy.Sigmoid)).toEqual(
      input.map(sigmoid)
    );
    expect(
      Normalizer.Numbers([1, 2, 4], Normalizer.Strategy.FixedRatio)
    ).toEqual([0.25, 0.5, 1]);
  });

  it("calculates cosine similarity between Typescript interfaces", () => {
    const interfaceA = `interface Root {
      id: string;
      reviews: Review[];
    }
    interface Review {
      reviewer: string;
      text: string;
    }`;
    const interfaceB = `interface Root {
      id: string;
      reviews: Review[];
    }
    interface Review {
      rating: Rating;
      reviewer: string;
      text: string;
    }
    interface Rating {
      color: string;
      stars: number;
    }`;
    const interfaceC = `interface Root {
      id: number;
      ratings: Ratings;
    }
    interface Ratings {
      Reviewer1: number;
      Reviewer2: number;
    }`;

    const testObj1 = [
      {
        id: "61d58fabd7cb2766e01db3c6",
        originId: null,
        ordinaryUserName: null,
        dataRequesterName: "新創公司A",
        dataHolderName: "台灣電力公司",
        firstSignDate: 0,
        secondSignDate: 0,
        signState: 0,
      },
      {
        id: "61d58facd7cb2766e01db7b0",
        originId: null,
        ordinaryUserName: null,
        dataRequesterName: "新創公司A",
        dataHolderName: "台灣電力公司",
        firstSignDate: 0,
        secondSignDate: 0,
        signState: -3,
      },
    ];
    const testObj2 = {
      id: "5fc0b2b71952525d6bc3c524",
      email: "request",
      telephone: null,
      mobilePhone: "0912345678",
      address: "某處",
      password: null,
      userType: 1,
      certificates: null,
      keys: null,
      principalName: "負責人A",
      organizationName: "新創公司A",
    };
    const testObj3 = {
      id: "61d58fabd7cb2766e01db3c6",
      originId: null,
      ordinaryUserName: null,
      dataRequesterName: "新創公司A",
      dataHolderName: "台灣電力公司",
      firstSignDate: 0,
      secondSignDate: 0,
      signState: 0,
    };

    expect(Utils.InterfaceCosineSimilarity(interfaceA, interfaceA)).toBeCloseTo(
      1
    );
    expect(Utils.InterfaceCosineSimilarity(interfaceA, interfaceB)).toBeCloseTo(
      0.775
    );
    expect(Utils.InterfaceCosineSimilarity(interfaceA, interfaceC)).toBeCloseTo(
      0.167
    );
    expect(Utils.InterfaceCosineSimilarity(interfaceB, interfaceC)).toBeCloseTo(
      0.129
    );
    const interfaceObj1 = Utils.ObjectToInterfaceString(testObj1);
    const interfaceObj2 = Utils.ObjectToInterfaceString(testObj2);
    const interfaceObj3 = Utils.ObjectToInterfaceString(testObj3);
    expect(
      Utils.InterfaceCosineSimilarity(interfaceObj1, interfaceObj2)
    ).toBeCloseTo(0.101);
    expect(
      Utils.InterfaceCosineSimilarity(interfaceObj1, interfaceObj3)
    ).toBeCloseTo(0.94);
  });

  it("maps object to OpenAPI type", () => {
    const obj = {
      name: "string",
      nestObj: {
        array: [1, 2, 3],
        id: "test",
      },
    };
    expect(Utils.MapObjectToOpenAPITypes(obj)).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        nestObj: {
          type: "object",
          properties: {
            array: { type: "array", items: { type: "number" } },
            id: { type: "string" },
          },
        },
      },
    });
  });

  it("gets parameters form url", () => {
    expect(Utils.GetParamsFromUrl("http://example.com/?a=b&b=a&a=a")).toEqual([
      { param: "a", type: "string" },
      { param: "b", type: "string" },
    ]);
  });

  it("removes duplicated parameters", () => {
    expect(
      Utils.UniqueParams([
        { param: "a", type: "string" },
        { param: "a", type: "string" },
        { param: "b", type: "string" },
        { param: "b", type: "string" },
        { param: "a", type: "string" },
        { param: "b", type: "string" },
      ])
    ).toEqual([
      { param: "a", type: "string" },
      { param: "b", type: "string" },
    ]);
  });

  it("merges objects or array of objects", () => {
    const obj1 = { name: "test", nestObj: { time: 123 } };
    const obj2 = { id: "123", nestObj: { id: "123", array: [1, 2, 3, 4, 5] } };

    const arr1 = [{ name: "123" }, { name: "234", id: 123 }];
    const arr2 = [
      { name: "456" },
      { id: 234 },
      { id: 1234, array: [1, 2, 3, 4, 5] },
    ];

    expect(Utils.Merge(obj1, obj2)).toEqual({
      name: "test",
      nestObj: { id: "123", array: [1, 2, 3, 4, 5] },
      id: "123",
    });
    expect(Utils.Merge(arr1, arr2)).toEqual([
      { name: "123" },
      { name: "234", id: 123 },
      { name: "456" },
      { id: 234 },
      { id: 1234, array: [1, 2, 3, 4, 5] },
    ]);
  });

  it("merges stringified body", () => {
    const str1 = JSON.stringify({ name: "test", nestObj: { time: 123 } });
    const str2 = JSON.stringify({
      id: "123",
      nestObj: { id: "123", array: [1, 2, 3, 4, 5] },
    });

    expect(Utils.MergeStringBody(str1, str2)).toEqual(
      JSON.stringify({
        name: "test",
        nestObj: { id: "123", array: [1, 2, 3, 4, 5] },
        id: "123",
      })
    );
  });
});

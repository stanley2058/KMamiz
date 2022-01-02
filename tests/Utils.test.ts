import Utils from "../src/utils/Utils";

describe("Utils", () => {
  it("Create interface string from object", () => {
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
  });

  it("Explode url into sections", () => {
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

  it("Get timestamp of 00:00 of the same day as the given timestamp", () => {
    const timestamp = new Date().getTime();
    expect(Utils.BelongsToDateTimestamp(timestamp)).toEqual(
      new Date(new Date(timestamp).toLocaleDateString()).getTime()
    );
  });

  it("Normalize numbers", () => {
    const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));
    const input = [1, 2, 3];
    expect(
      Utils.NormalizeNumbers(input, Utils.NormalizeStrategy.BetweenFixedNumber)
    ).toEqual([0.1, 0.55, 1]);

    expect(
      Utils.NormalizeNumbers(input, Utils.NormalizeStrategy.Sigmoid)
    ).toEqual(input.map(sigmoid));
  });
});

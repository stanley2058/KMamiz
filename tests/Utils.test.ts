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
    expect(
      Utils.InterfaceCosineSimilarity(
        Utils.ObjectToInterfaceString(testObj1),
        Utils.ObjectToInterfaceString(testObj2)
      )
    ).toBeCloseTo(0.107);
  });

  it("guesses API endpoints based on requests and request bodies", () => {
    const urls = [
      "/api/user/0",
      "/api/user/0/id",
      "/api/user/0/name",
      "/api/user/1",
      "/api/user/1/id",
      "/api/user/1/name",
      "/api/user/0/record/0",
      "/api/user/1/record/2",
      "/api/product",
      "/api/product/254e1263-1356-4461-bb92-15dd36ea37f2/info",
      "/api/product/254e1263-1356-4461-bb92-15dd36ea37f2/comment/0",
      "/api/product/fb631f10-e7c7-40e8-bc63-7c2384dd8bed/info",
      "/api/product/fb631f10-e7c7-40e8-bc63-7c2384dd8bed/comment/1",
      "/api/product/fb631f10-e7c7-40e8-bc63-7c2384dd8bed/comment/2",
    ];
    const bodies = [
      "1",
      "2",
      "3",
      "1",
      "2",
      "3",
      "4",
      "4",
      "5",
      "6",
      "7",
      "6",
      "7",
      "7",
    ];

    const guesses = Utils.ExtractPathPattern(urls);
    const guessesWithBody = Utils.ExtractPathPatternWithBody(urls, bodies);

    const expectResult1 = new Set([
      "/api/user/{}",
      "/api/user/{}/id",
      "/api/user/{}/name",
      "/api/user/{}/record/{}",
      "/api/product",
      "/api/product/254e1263-1356-4461-bb92-15dd36ea37f2/info",
      "/api/product/254e1263-1356-4461-bb92-15dd36ea37f2/comment/0",
      "/api/product/fb631f10-e7c7-40e8-bc63-7c2384dd8bed/info",
      "/api/product/fb631f10-e7c7-40e8-bc63-7c2384dd8bed/comment/{}",
    ]);
    const expectResult2 = new Set([
      "/api/user/{}",
      "/api/user/{}/id",
      "/api/user/{}/name",
      "/api/user/{}/record/{}",
      "/api/product",
      "/api/product/{}/info",
      "/api/product/{}/comment/{}",
    ]);
    expect(guesses).toBeTruthy();
    expect(guessesWithBody).toBeTruthy();
    expect(new Set([...guesses!.values()])).toEqual(expectResult1);
    expect(new Set([...guessesWithBody!.values()])).toEqual(expectResult2);
  });
});

import { FeatureToggle, FeatureToggleBase } from "..";
import { LocalStorageFeatureProvider } from "../examples/LocalStorageFeatureProvider";

FeatureToggleBase.featureProvider = new LocalStorageFeatureProvider(
  "../test/test-feature.json"
);

class Demo3 {
  constructor() {}

  async five() {
    return Promise.resolve(9);
  }
}

@FeatureToggle("myClassToggle", Demo3)
class Demo2 {
  constructor() {}

  async five() {
    return Promise.resolve(5);
  }
}

function myFallback() {
  console.log("hiyaa");
}

export class Demo {
  demo: Demo2;
  constructor() {
    this.demo = new Demo2();
  }

  @FeatureToggle("myMethodToggle")
  method() {
    console.log("Hello world!");
    this.demo.five().then((val) => console.log(val));
  }

  @FeatureToggle("myOtherMethodToggle", myFallback)
  othermethod() {
    console.log("Hello other world!");
  }
}

describe("YaFT Demo", () => {
  it("should create test", () => {
    const test = new Demo();
    test.method();
    test.othermethod();
  });
});

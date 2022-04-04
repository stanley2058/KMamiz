const path = require("path");

const name = "RealtimeWorkerImpl";

if (process.env.NODE_ENV === "production") {
  require(path.resolve(__dirname, `./${name}.js`));
} else {
  require("ts-node").register();
  require(path.resolve(__dirname, `./${name}.ts`));
}

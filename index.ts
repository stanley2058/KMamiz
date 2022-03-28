import express from "express";
import cors from "cors";
import compression from "compression";
import Routes from "./src/routes/Routes";
import GlobalSettings from "./src/GlobalSettings";
import Logger from "./src/utils/Logger";
import MongoOperator from "./src/services/MongoOperator";
import Initializer from "./src/services/Initializer";
import DataCache from "./src/services/DataCache";
import exitHook from "async-exit-hook";
import DispatchStorage from "./src/services/DispatchStorage";
import { CCombinedRealtimeData } from "./src/classes/Cacheable/CCombinedRealtimeData";
import path from "path";

Logger.setGlobalLogLevel(GlobalSettings.LogLevel);
Logger.verbose("Configuration loaded:");
Logger.plain.verbose("", GlobalSettings);
Logger.plain.verbose(
  "KUBERNETES_SERVICE_HOST:",
  process.env.KUBERNETES_SERVICE_HOST
);
Logger.plain.verbose(
  "KUBERNETES_SERVICE_PORT:",
  process.env.KUBERNETES_SERVICE_PORT
);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(compression());

app.use(Routes.getInstance().getRoutes());

// serve SPA webpage
app.use(express.static("dist"));
app.get("*", (_, res) =>
  res.sendFile(path.resolve(__dirname, "dist/index.html"))
);

(async () => {
  const aggregateData = await MongoOperator.getInstance().getAggregateData();

  if (GlobalSettings.ResetEndpointDependencies) {
    Logger.info("Resetting EndpointDependencies.");
    await Initializer.getInstance().forceRecreateEndpointDependencies();
  }

  Logger.info("Running startup tasks.");
  await Initializer.getInstance().serverStartUp();

  const rlData = DataCache.getInstance()
    .get<CCombinedRealtimeData>("CombinedRealtimeData")
    .getData();

  if (!aggregateData && rlData?.toJSON().length === 0) {
    Logger.info("Database is empty, running first time setup.");
    await Initializer.getInstance().firstTimeSetup();
  }

  Logger.info("Initialization done, starting server");
  app.listen(GlobalSettings.Port, () => {
    Logger.info(`Express server started on port: ${GlobalSettings.Port}`);
    exitHook(async (callback) => {
      Logger.info("Received termination signal, execute teardown procedures.");

      if (!GlobalSettings.ReadOnlyMode) {
        Logger.info("Syncing to database.");
        await DispatchStorage.getInstance().syncAll();
      } else {
        Logger.info("Readonly mode enabled, skipping teardown.");
      }

      Logger.info("Done, stopping the server.");
      callback();
    });
  });
})();

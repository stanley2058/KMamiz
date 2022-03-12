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

Logger.setGlobalLogLevel(GlobalSettings.LogLevel);
Logger.verbose("Configuration loaded:");
Logger.plain.verbose("", GlobalSettings);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(compression());

app.use(Routes.getInstance().getRoutes());

(async () => {
  const aggregateData = await MongoOperator.getInstance().getAggregateData();

  if (GlobalSettings.ResetEndpointDependencies) {
    Logger.info("Resetting EndpointDependencies.");
    await Initializer.getInstance().forceRecreateEndpointDependencies();
  }

  Logger.info("Running startup tasks.");
  await Initializer.getInstance().serverStartUp();

  if (
    !aggregateData &&
    DataCache.getInstance().combinedRealtimeDataSnap?.toJSON().length === 0
  ) {
    Logger.info("Database is empty, running first time setup.");
    await Initializer.getInstance().firstTimeSetup();
  }

  Logger.info("Initialization done, starting server");
  app.listen(GlobalSettings.Port, () => {
    Logger.info(`Express server started on port: ${GlobalSettings.Port}`);
    exitHook(async (callback) => {
      Logger.info("Received termination signal, execute teardown procedures.");
      Logger.info("Syncing to database.");
      await DispatchStorage.getInstance().syncAll();
      Logger.info("Done, stopping the server.");
      callback();
    });
  });
})();

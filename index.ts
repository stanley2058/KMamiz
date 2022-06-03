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
import KubernetesService from "./src/services/KubernetesService";
import cacheControl from "express-cache-controller";

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

if (GlobalSettings.ServeOnly) {
  Logger.info(
    "System running in ServeOnly mode, only webpage and wasm plugin are accessible."
  );
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(compression());
app.use(cacheControl({ maxAge: 3600 }));

// serve SPA webpage
app.use("/wasm", express.static("wasm"));
app.use(express.static("dist"));
app.get("*", (_, res) =>
  res.sendFile(path.resolve(__dirname, "dist/index.html"))
);

if (!GlobalSettings.ServeOnly) {
  app.use(Routes.getInstance().getRoutes());
}

(async () => {
  if (!GlobalSettings.ServeOnly) {
    if (GlobalSettings.IsRunningInKubernetes) {
      await KubernetesService.getInstance().forceKMamizSync();
    }

    const aggregatedData =
      await MongoOperator.getInstance().getAggregatedData();

    if (GlobalSettings.ResetEndpointDependencies) {
      Logger.info("Resetting EndpointDependencies.");
      await Initializer.getInstance().forceRecreateEndpointDependencies();
    }

    Logger.info("Running startup tasks.");
    await Initializer.getInstance().serverStartUp();

    const rlData = DataCache.getInstance()
      .get<CCombinedRealtimeData>("CombinedRealtimeData")
      .getData();

    if (!aggregatedData && rlData?.toJSON().length === 0) {
      Logger.info("Database is empty, running first time setup.");
      try {
        await Initializer.getInstance().firstTimeSetup();
      } catch (err) {
        Logger.error("Cannot run first time setup, skipping.");
        Logger.plain.error("", err);
      }
    }
  }

  Logger.info("Initialization done, starting server");
  app.listen(GlobalSettings.Port, () => {
    Logger.info(`Express server started on port: ${GlobalSettings.Port}`);
    exitHook(async (callback) => {
      Logger.info("Received termination signal, execute teardown procedures.");

      if (!GlobalSettings.ReadOnlyMode && !GlobalSettings.ServeOnly) {
        await DispatchStorage.getInstance().syncAll();
      } else {
        Logger.info("Readonly mode enabled, skipping teardown.");
      }

      Logger.info("Done, stopping the server.");
      callback();
    });
  });
})();

import express from "express";
import cors from "cors";
import compression from "compression";
import Routes from "./src/routes/Routes";
import GlobalSettings from "./src/GlobalSettings";
import Logger from "./src/utils/Logger";

Logger.setGlobalLogLevel(GlobalSettings.LogLevel);
Logger.verbose("Configuration loaded:");
Logger.plain.verbose("", GlobalSettings);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(compression());

app.use(Routes.getInstance().getRoutes());

// Start testing area
(async () => {
  // const print = (obj: any) => require("util").inspect(obj, false, null, true);
  // const namespace = "book";
  // const traces = new Trace(
  //   await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
  //     86400000 * 30
  //   )
  // );
  // const envoyLogs: EnvoyLogs[] = [];
  // for (const podName of await KubernetesService.getInstance().getPodNames(
  //   namespace
  // )) {
  //   envoyLogs.push(
  //     await KubernetesService.getInstance().getEnvoyLogs(namespace, podName)
  //   );
  // }
  // const replicas = await KubernetesService.getInstance().getReplicasFromPodList(
  //   namespace
  // );
  // // console.log(print(EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs)));
  // const rlDataWithLogs = traces.combineLogsToRealtimeData(
  //   EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs)
  // );
  // const risk = RiskAnalyzer.RealtimeRisk(
  //   rlDataWithLogs.realtimeData,
  //   traces.toEndpointDependencies().toServiceDependencies(),
  //   replicas
  // );
  // console.log(print(risk));
  // const { aggregateData, historyData } =
  //   rlDataWithLogs.toAggregatedDataAndHistoryData(
  //     traces.toEndpointDependencies().toServiceDependencies()
  //   );
  // console.log(print(aggregateData));
  // console.log(print(historyData));
  // console.log(print(traces.toEndpointDependencies().toGraphData()));
  // console.log(print(traces.toEndpointDependencies().dependencies));
  // console.log(
  //   print(
  //     traces
  //       .toRealTimeData()
  //       .toHistoryData(traces.toEndpointDependencies().toServiceDependencies())
  //   )
  // );
  // console.log(print(Object.fromEntries(endpointDataTypeMap)));
  // console.log(print(rlDataWithLogs.extractEndpointDataType()));
})();
// End testing area

app.listen(GlobalSettings.Port, () => {
  Logger.info(`Express server running on port: ${GlobalSettings.Port}`);
});

require("dotenv").config();
import express from "express";
import cors from "cors";
import Routes from "./src/routes/Routes";
import ZipkinService from "./src/services/ZipkinService";
import KubernetesService from "./src/services/KubernetesService";
import Utils from "./src/utils/Utils";
import RiskAnalyzer from "./src/utils/RiskAnalyzer";
import RealtimeData from "./src/interfaces/RealtimeData";
import EnvoyLog from "./src/interfaces/EnvoyLog";
import DataAggregator from "./src/utils/DataAggregator";
import StructuredEnvoyLog from "./src/interfaces/StructuredEnvoyLog";
import DataTransformer from "./src/utils/DataTransformer";
import Logger from "./src/utils/Logger";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use(Routes.getInstance().getRoutes());

// Start testing area
(async () => {
  const namespace = "book";
  const traces =
    await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
      86400000 * 30
    );

  // console.log(
  //   JSON.stringify(DataTransformer.TracesToEndpointDependencies(traces))
  // );

  const envoyLogs: StructuredEnvoyLog[][] = [];
  const rawLogs = [];
  for (const podName of await KubernetesService.getInstance().getPodNames(
    namespace
  )) {
    envoyLogs.push(
      await KubernetesService.getInstance().getStructuredEnvoyLogs(
        namespace,
        podName
      )
    );
    rawLogs.push(
      await KubernetesService.getInstance().getEnvoyLogs(namespace, podName)
    );
  }
  // console.log(JSON.stringify(rawLogs.slice(0, 1).map((l) => l.slice(0, 5))));

  // console.log(JSON.stringify(envoyLogs.slice(0, 2)));

  // const realtimeData = DataAggregator.TracesAndLogsToRealtimeData(
  //   traces,
  //   DataAggregator.CombineStructuredEnvoyLogs(envoyLogs)
  // );
  // console.log(realtimeData);

  const replicas = (
    await KubernetesService.getInstance().getReplicasFromPodList(namespace)
  ).map((r) => {
    if (r.service !== "ratings") return r;
    return {
      ...r,
      replicas: 1,
    };
  });
  // console.log(replicas);

  const realtimeData = DataTransformer.TracesToRealTimeData(traces);
  const serviceDependency =
    DataTransformer.EndpointDependenciesToServiceDependencies(
      DataTransformer.TracesToEndpointDependencies(traces)
    );

  // console.log(realtimeData);
  // console.log(serviceDependency);

  const risk = RiskAnalyzer.RealtimeRisk(
    realtimeData,
    serviceDependency,
    replicas
  );
  console.log(risk);

  const impact = Utils.NormalizeNumbers(
    [1, 1, 1, 1, 1, 2.5],
    Utils.NormalizeStrategy.BetweenFixedNumber
  );
  const prob = Utils.NormalizeNumbers(
    [0.000174, 0.000555, 0.000605, 0.000433, 0.000056, 0.000081],
    Utils.NormalizeStrategy.BetweenFixedNumber
  );
  console.log(impact.map((r, i) => r * prob[i]));
  console.log(
    Utils.NormalizeNumbers(
      impact.map((r, i) => r * prob[i]),
      Utils.NormalizeStrategy.BetweenFixedNumber
    )
  );
  console.log(
    JSON.stringify(
      DataAggregator.TracesToAggregatedDataAndHistoryData(traces, replicas)
    )
  );
})();
// End testing area

app.listen(process.env.PORT || 3000, () => {
  console.log(`Express server running on port: ${process.env.PORT || 3000}`);
});

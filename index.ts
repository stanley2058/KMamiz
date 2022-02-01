require("dotenv").config();
import express from "express";
import cors from "cors";
import Routes from "./src/routes/Routes";
import { EnvoyLogs } from "./src/classes/EnvoyLog";
import { Trace } from "./src/classes/Trace";
import KubernetesService from "./src/services/KubernetesService";
import ZipkinService from "./src/services/ZipkinService";
import RiskAnalyzer from "./src/utils/RiskAnalyzer";
import { inspect } from "util";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use(Routes.getInstance().getRoutes());

// Start testing area
(async () => {
  const namespace = "book";
  const traces = new Trace(
    await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
      86400000 * 30
    )
  );

  const envoyLogs: EnvoyLogs[] = [];
  for (const podName of await KubernetesService.getInstance().getPodNames(
    namespace
  )) {
    envoyLogs.push(
      await KubernetesService.getInstance().getEnvoyLogs(namespace, podName)
    );
  }
  const replicas = await KubernetesService.getInstance().getReplicasFromPodList(
    namespace
  );

  const risk = RiskAnalyzer.RealtimeRisk(
    traces.combineLogsToRealtimeData(
      EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs)
    ).realtimeData,
    traces.toEndpointDependencies().toServiceDependencies(),
    replicas
  );

  const print = (obj: any) => inspect(obj, false, null, true);
  console.log(risk);
  console.log(print(traces.toEndpointDependencies().toGraphData()));
  console.log(print(traces.toEndpointDependencies().dependencies));
})();
// End testing area

app.listen(process.env.PORT || 3000, () => {
  console.log(`Express server running on port: ${process.env.PORT || 3000}`);
});

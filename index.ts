require("dotenv").config();
import express from "express";
import cors from "cors";
import Routes from "./src/routes/Routes";
import ZipkinService from "./src/services/ZipkinService";
import KubernetesService from "./src/services/KubernetesService";
import Utils from "./src/services/Utils";
import RiskAnalyzer from "./src/services/RiskAnalyzer";
import RealtimeData from "./src/interfaces/RealtimeData";
import EnvoyLog from "./src/interfaces/EnvoyLog";
import DataAggregator from "./src/services/DataAggregator";
import StructuredEnvoyLog from "./src/interfaces/StructuredEnvoyLog";

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
      "istio-ingressgateway.istio-system",
      Date.now(),
      86400000 * 30
    );

  const envoyLogs: StructuredEnvoyLog[][] = [];
  for (const podName of await KubernetesService.getInstance().getPodNames(
    namespace
  )) {
    const logs = await KubernetesService.getInstance().getEnvoyLogs(
      namespace,
      podName
    );

    envoyLogs.push(KubernetesService.getInstance().structureEnvoyLogs(logs));
  }

  const realtimeData =
    DataAggregator.getInstance().createRealtimeDataFromTracesAndLogs(
      traces,
      KubernetesService.getInstance().combineStructuredEnvoyLogs(envoyLogs)
    );
  // console.log(realtimeData.length);
  // console.log(RiskAnalyzer.CalculateReliabilityMetric(realtimeData));

  const risk = Utils.NormalizeNumbers(
    [1, 1, 1, 1, 1, 3],
    Utils.NormalizeStrategy.BetweenFixedNumber
  );
  const prob = Utils.NormalizeNumbers(
    [0.000174, 0.000555, 0.000605, 0.000433, 0.000056, 0.000081],
    Utils.NormalizeStrategy.BetweenFixedNumber
  );
  console.log(risk.map((r, i) => r * prob[i]));
  console.log(
    Utils.NormalizeNumbers(
      risk.map((r, i) => r * prob[i]),
      Utils.NormalizeStrategy.BetweenFixedNumber
    )
  );

  // productpage-v1 Norm(1/1) * Norm(0.6259875891069403  * 0.278 * 0.001) = Norm(1) * Norm(0.000174) =
  // reviews-v1     Norm(1/1) * Norm(1                   * 0.111 * 0.005) = Norm(1) * Norm(0.000555) =
  // reviews-v2     Norm(1/1) * Norm(0.7287172536262556  * 0.083 * 0.010) = Norm(1) * Norm(0.000605) =
  // reviews-v3     Norm(1/1) * Norm(0.7451663179693577  * 0.083 * 0.007) = Norm(1) * Norm(0.000433) =
  // details-v1     Norm(1/1) * Norm(0.1                 * 0.278 * 0.002) = Norm(1) * Norm(0.000056) =
  // ratings-v1     Norm(3/1) * Norm(0.16155461795545867 * 0.167 * 0.003) = Norm(3) * Norm(0.000081) =
})();
// End testing area

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`Express server running on port: ${process.env.PORT ?? 3000}`);
});

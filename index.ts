require("dotenv").config();
import express from "express";
import cors from "cors";
import Routes from "./src/routes/Routes";
import ZipkinService from "./src/services/ZipkinService";
import KubernetesService from "./src/services/EnvoyLogAnalyzer";
import Utils from "./src/services/Utils";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use(Routes.getInstance().getRoutes());

// Start testing area
(async () => {
  const services = await ZipkinService.getInstance().getServicesFromZipkin();
  console.log(`Services: ${services}`);

  const traces =
    await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
      services[2],
      Date.now(),
      86400000 * 30
    );
  console.log(`Trace Count: ${traces.length}`);

  const dependencyMapping =
    ZipkinService.getInstance().retrieveEndpointDependenciesFromZipkin(traces);
  console.log(dependencyMapping);
  console.log(
    ZipkinService.getInstance().transformEndpointDependenciesToGraphData(
      dependencyMapping
    )
  );

  const namespaces = await KubernetesService.getInstance().getNamespaces();
  console.log(namespaces[0]);
  const pods = await KubernetesService.getInstance().getPodNames(namespaces[0]);
  console.log(pods);
  console.log(
    await KubernetesService.getInstance().getReplicasFromPodList(namespaces[0])
  );
  const logs = await KubernetesService.getInstance().getEnvoyLogs(
    namespaces[0],
    pods[1]
  );
  console.log(logs);
})();
// End testing area

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`Express server running on port: ${process.env.PORT ?? 3000}`);
});

import { parentPort } from "worker_threads";
import { EndpointDependencies } from "../../classes/EndpointDependencies";
import { EnvoyLogs } from "../../classes/EnvoyLog";
import { Traces } from "../../classes/Traces";
import { TReplicaCount } from "../../entities/TReplicaCount";
import KubernetesService from "../KubernetesService";
import ZipkinService from "../ZipkinService";

parentPort?.on("message", async ({ uniqueId, lookBack, existingDep }) => {
  const traces = new Traces(
    await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
      lookBack,
      Date.now(),
      2500
    )
  );

  // get namespaces from traces for querying envoy logs
  const namespaces = traces.extractContainingNamespaces();

  // get all necessary envoy logs
  const envoyLogs: EnvoyLogs[] = [];
  const replicas: TReplicaCount[] =
    await KubernetesService.getInstance().getReplicas(namespaces);
  for (const ns of namespaces) {
    for (const podName of await KubernetesService.getInstance().getPodNames(
      ns
    )) {
      envoyLogs.push(
        await KubernetesService.getInstance().getEnvoyLogs(ns, podName)
      );
    }
  }

  const data = traces.combineLogsToRealtimeData(
    EnvoyLogs.CombineToStructuredEnvoyLogs(envoyLogs),
    replicas
  );

  const newDep = traces.toEndpointDependencies();
  const dep: EndpointDependencies = existingDep
    ? new EndpointDependencies(existingDep).combineWith(newDep)
    : newDep;
  const cbData = data.toCombinedRealtimeData();
  const dataType = cbData.extractEndpointDataType();

  const res = {
    uniqueId,
    rlDataList: cbData.toJSON(),
    dependencies: dep.toJSON(),
    dataType: dataType.map((d) => d.toJSON()),
  };
  parentPort?.postMessage(res);
});

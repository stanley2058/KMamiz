import { parentPort, workerData } from "worker_threads";
import { EndpointDependencies } from "../../classes/EndpointDependencies";
import { EnvoyLogs } from "../../classes/EnvoyLog";
import { Traces } from "../../classes/Traces";
import { TReplicaCount } from "../../entities/TReplicaCount";
import KubernetesService from "../KubernetesService";
import ZipkinService from "../ZipkinService";

async function CreateRealtimeData() {
  const traces = new Traces(
    await ZipkinService.getInstance().getTraceListFromZipkinByServiceName(
      workerData.lookBack,
      Date.now(),
      2500
    )
  );

  // get namespaces from traces for querying envoy logs
  const namespaces = traces.toRealTimeData().getContainingNamespaces();

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

  const { existingDep } = workerData;
  const newDep = traces.toEndpointDependencies();
  const dep: EndpointDependencies = existingDep
    ? new EndpointDependencies(existingDep).combineWith(newDep)
    : newDep;
  const cbData = data.toCombinedRealtimeData();
  const dataType = cbData.extractEndpointDataType();

  return {
    rlDataList: cbData.toJSON(),
    dependencies: dep.toJSON(),
    dataType: dataType.map((d) => d.toJSON()),
  };
}

CreateRealtimeData().then((res) => {
  parentPort?.postMessage(res);
});

export default interface IReplicaCount {
  uniqueServiceName: string;
  service: string;
  namespace: string;
  version: string;
  replicas: number;
}

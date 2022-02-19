export default interface IRiskResult {
  uniqueServiceName: string;
  norm: number;
  service: string;
  namespace: string;
  version: string;
  risk: number;
  impact: number;
  probability: number;
}

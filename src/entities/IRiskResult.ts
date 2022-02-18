export default interface IRiskResult {
  norm: number;
  service: string;
  namespace: string;
  version: string;
  risk: number;
  impact: number;
  probability: number;
}

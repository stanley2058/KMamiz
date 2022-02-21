export type IAreaLineChartDataFields =
  | "requests"
  | "serverErrors"
  | "requestErrors"
  | "risk"
  | "latencyCV";

export default interface IAreaLineChartData {
  name: string;
  x: Date;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
  risk?: number;
}

export type TAreaLineChartDataFields =
  | "requests"
  | "serverErrors"
  | "requestErrors"
  | "risk"
  | "latencyCV";

export type TAreaLineChartData = {
  name: string;
  x: Date;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
  risk?: number;
};

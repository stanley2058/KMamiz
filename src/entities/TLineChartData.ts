export type TLineChartDataFields =
  | "requests"
  | "serverErrors"
  | "requestErrors"
  | "risk"
  | "latencyCV";

export type TLineChartData = {
  name: string;
  x: Date;
  requests: number;
  serverErrors: number;
  requestErrors: number;
  latencyCV: number;
  risk?: number;
};

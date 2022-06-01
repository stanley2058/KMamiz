export type TRequestInfoChartData = {
  time: number[];
  requests: number[];
  clientErrors: number[];
  serverErrors: number[];
  latencyCV: number[];
  risks?: number[];
  totalRequestCount: number;
  totalClientErrors: number;
  totalServerErrors: number;
};

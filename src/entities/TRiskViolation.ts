export type TRiskViolation = {
  id: string;
  uniqueServiceName: string;
  displayName: string;
  occursAt: number;
  timeoutAt: number;
  highlightNodeName: string;
};

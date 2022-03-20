export type TEndpointLabel = {
  labels: TEndpointLabelType[];
};

export type TEndpointLabelType = {
  uniqueServiceName: string;
  method: string;
  label: string;
  samples: string[];
  block?: boolean;
};

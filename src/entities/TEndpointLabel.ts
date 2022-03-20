export type TEndpointLabel = {
  labels: TEndpointLabelType[];
};

export type TEndpointLabelType = {
  label: string;
  samples: string[];
  block?: boolean;
};

export type TGraphData = {
  nodes: TNode[];
  links: TLink[];
};

export type TNode = {
  // unique id, for linking
  id: string;
  // display name
  name: string;
  // group as a service
  group: string;
  // id list for all dependencies
  dependencies: string[];
  linkInBetween: TLink[];
};
export type TLink = {
  // link from id
  source: string;
  // link to id
  target: string;
};

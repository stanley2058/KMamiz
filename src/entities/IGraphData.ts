export default interface IGraphData {
  nodes: INode[];
  links: ILink[];
  services: string[];
}

export interface INode {
  // unique id, for linking
  id: string;
  // display name
  name: string;
  // group as a service
  group: string;
}
export interface ILink {
  // link from id
  source: string;
  // link to id
  target: string;
}

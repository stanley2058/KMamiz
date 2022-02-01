export default interface IGraphData {
  nodes: INode[];
  links: ILink[];
}

export interface INode {
  // unique id, for linking
  id: string;
  // display name
  name: string;
  // group as a service
  group: string;
  // id list for all dependencies
  dependencies: string[];
  linkInBetween: ILink[];
}
export interface ILink {
  // link from id
  source: string;
  // link to id
  target: string;
}

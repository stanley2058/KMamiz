export default interface IGraphData {
  nodes: { id: string; name: string; group: string }[];
  links: { source: string; target: string }[];
}

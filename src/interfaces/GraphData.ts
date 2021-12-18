export default interface GraphData {
  nodes: { id: string; name: string; group: string }[];
  links: { source: string; target: string }[];
}

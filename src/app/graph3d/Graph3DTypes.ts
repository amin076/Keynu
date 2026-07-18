export type Graph3DNode = {
  id: string;
  label: string;
  kind: string;
  state: string;
  path?: string;
};

export type Graph3DEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
  state: string;
};

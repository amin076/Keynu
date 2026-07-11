export interface Workspace {
  id:string;
  name:string;
  path:string;
  git:boolean;
  memory:boolean;
  drivers:string[];
  services:string[];
  sessions:string[];
  status:'OPEN'|'CLOSED';
  createdAt:string;
  updatedAt:string;
}

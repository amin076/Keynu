export class WorkspaceRegistry {
  private readonly workspaces=new Map<string,unknown>();
  register(id:string,workspace:unknown){this.workspaces.set(id,workspace);}
  get(id:string){return this.workspaces.get(id);}
  list(){return [...this.workspaces.values()];}
}

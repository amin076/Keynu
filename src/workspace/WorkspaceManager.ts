import {Workspace} from './Workspace.js';
export class WorkspaceManager{
private current?:Workspace;
private readonly listStore:Workspace[]=[];
open(ws:Workspace){this.current=ws;this.listStore.push(ws);}
switch(id:string){this.current=this.listStore.find(w=>w.id===id);}
currentWorkspace(){return this.current;}
list(){return this.listStore;}
close(){this.current=undefined;}
}

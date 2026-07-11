export class ExecutionGuard {
  static validateExecution(result:any){
    if(!result){
      return {ok:false,error:'Missing execution result'};
    }

    if(Array.isArray(result.commands) && result.commands.length===0){
      return {ok:false,error:'No commands were executed'};
    }

    return {ok:true};
  }
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initialRuntimeSnapshot, subscribeRuntime, type RuntimeSnapshot } from './RuntimeStore.js';
const RuntimeContext=createContext<any>(null);
export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeSnapshot>(initialRuntimeSnapshot);

  useEffect(() => subscribeRuntime(setRuntime), []);

  useEffect(() => {
    let disposed=false;
    async function refresh(){
      try{
        const response=await fetch('/api/dashboard/status',{cache:'no-store'});
        if(!response.ok||disposed)return;
        const status=await response.json();
        setRuntime(current=>({
          ...current,
          runtime:status.status??current.runtime,
          updatedAt:status.time??new Date().toISOString()
        }));
      }catch{}
    }
    refresh();
    const timer=setInterval(refresh,1000);
    return()=>{disposed=true;clearInterval(timer);};
  },[]);

  return (
    <RuntimeContext.Provider value={{ runtime, setRuntime }}>
      {children}
    </RuntimeContext.Provider>
  );
}
export function useRuntime(){const c=useContext(RuntimeContext);if(!c)throw new Error('RuntimeProvider missing');return c;}

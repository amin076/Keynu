export type RuntimeSnapshot={runtime:string;browser:string;mission:string;drivers:number;queue:number;updatedAt:string;};

export const initialRuntimeSnapshot:RuntimeSnapshot={runtime:'Healthy',browser:'Connected',mission:'Active',drivers:3,queue:0,updatedAt:new Date().toISOString()};

let snapshot={...initialRuntimeSnapshot};

export function getRuntimeSnapshot(){return snapshot;}
export function updateRuntimeSnapshot(update:Partial<RuntimeSnapshot>){snapshot={...snapshot,...update,updatedAt:new Date().toISOString()};return snapshot;}


export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

const listeners = new Set<RuntimeListener>();

export function subscribeRuntime(listener: RuntimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishRuntime(update: Partial<RuntimeSnapshot>): RuntimeSnapshot {
  snapshot = { ...snapshot, ...update, updatedAt: new Date().toISOString() };
  const published = { ...snapshot };
  for (const listener of listeners) {
    listener(published);
  }
  return published;
}

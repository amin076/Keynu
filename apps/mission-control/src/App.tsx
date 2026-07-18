import Layout from "./components/Layout.js";
import { AppShell } from "./components/AppShell.js";
import { useRuntime } from './state/RuntimeContext.js';

export default function App(){
  const { runtime } = useRuntime();
  return (
  <AppShell>
    <Layout runtime={runtime} />
  </AppShell>
);
}

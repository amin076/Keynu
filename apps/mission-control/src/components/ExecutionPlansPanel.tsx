import { useEffect, useState } from 'react';

type Step = { id: string; goal: string; status: string; phase?: string; action?: string;
  ready: boolean; waitingFor: string[]; alerts: string[]; reason?: string; aiCalls: number;
  maxAiCalls: number; nextSteps?: string[] };
type Plan = { id: string; projectId: string; goal: string; notBefore?: string; nextPlanId?: string; steps: Step[] };
export function ExecutionPlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch('/api/execution-monitor', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Execution monitor returned ${response.status}`);
        const data = await response.json();
        if (!controller.signal.aborted) { setPlans(data.plans ?? []); setPaused(data.paused === true); setError(undefined); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Monitor unavailable');
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(refresh, 5000); }
      }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <section className="execution-plans-panel" aria-labelledby="execution-plans-title">
    <h3 id="execution-plans-title">Supervised execution plans</h3>
    <p>Goals, progress checks and the next approved steps across your projects.</p>
    {paused && <p role="status">Execution is paused.</p>}
    {error && <p role="alert">{error} — displayed results may be out of date.</p>}
    {loading && <p>Loading execution plans…</p>}
    {!loading && !error && plans.length === 0 && <p>No execution plans have been added.</p>}
    {plans.map(plan => <details key={plan.id} open={plan.steps.some(step => step.status !== 'COMPLETED')}>
      <summary><strong>{plan.projectId}</strong> · {plan.goal}</summary>
      {plan.notBefore && <p>Scheduled for {new Date(plan.notBefore).toLocaleString()}</p>}
      <ol>{plan.steps.map(step => <li key={step.id}>
        <strong>{step.goal}</strong> — {step.status}{step.ready ? ' · Ready' : ''}
        {step.phase && step.phase !== 'IDLE' && <p>{step.phase}{step.action ? ` · ${step.action}` : ''}</p>}
        <p>AI requests: {step.aiCalls} / {step.maxAiCalls}</p>
        {step.waitingFor.length > 0 && <p>Waiting for: {step.waitingFor.join(', ')}</p>}
        {step.reason && <p>{step.reason}</p>}
        {step.alerts.length > 0 && <p role="status">Attention: {step.alerts.join(', ')}</p>}
        {!!step.nextSteps?.length && <p>Proposed follow-up: {step.nextSteps.join(' · ')}</p>}
      </li>)}</ol>
      {plan.nextPlanId && <p>The next scheduled run has been saved.</p>}
    </details>)}
  </section>;
}

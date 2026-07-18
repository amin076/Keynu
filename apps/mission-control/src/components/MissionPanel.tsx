import StatusCard, { type StatusTone } from './StatusCard.js';
import type { RuntimeSnapshot } from '../state/RuntimeStore.js';

export type MissionPanelProps = {
  runtime: RuntimeSnapshot;
};

export default function MissionPanel({ runtime }: MissionPanelProps) {
  const active = ['active','running'].includes(runtime.mission.trim().toLowerCase());
  const tone: StatusTone = active ? 'success' : 'neutral';

  return (
    <StatusCard
      title="Mission"
      value={runtime.mission}
      description="Current mission state."
      tone={tone}
      footer={<span>{active ? 'Mission execution is active' : 'Mission is idle'}</span>}
    />
  );
}

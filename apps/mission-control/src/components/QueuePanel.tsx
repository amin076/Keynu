import StatusCard, { type StatusTone } from './StatusCard.js';
import type { RuntimeSnapshot } from '../state/RuntimeStore.js';

export type QueuePanelProps = {
  runtime: RuntimeSnapshot;
};

export default function QueuePanel({ runtime }: QueuePanelProps) {
  const queue = Number(runtime.queue ?? 0);
  const tone: StatusTone = queue === 0 ? 'success' : 'warning';

  return (
    <StatusCard
      title="Queue"
      value={queue}
      description="Pending runtime jobs."
      tone={tone}
      footer={<span>{queue === 0 ? 'Queue is empty' : `${queue} pending job${queue === 1 ? '' : 's'}`}</span>}
    />
  );
}

import StatusCard, { type StatusTone } from "./StatusCard.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type RuntimePanelProps = {
  runtime: RuntimeSnapshot;
};

export default function RuntimePanel({ runtime }: RuntimePanelProps) {
  const normalizedStatus = runtime.runtime.trim().toLowerCase();
  const healthy = normalizedStatus === "online" || normalizedStatus === "healthy";
  const tone: StatusTone = healthy ? "success" : "warning";

  const updatedAt = new Date(runtime.updatedAt);
  const updatedLabel = Number.isNaN(updatedAt.getTime())
    ? "Update time unavailable"
    : `Last update ${updatedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })}`;

  return (
    <StatusCard
      title="Runtime"
      value={runtime.runtime}
      description="Current Keynu runtime execution state."
      tone={tone}
      footer={<span>{updatedLabel}</span>}
    />
  );
}

import StatusCard, { type StatusTone } from "./StatusCard.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type DriverPanelProps = {
  runtime: RuntimeSnapshot;
};

export default function DriverPanel({ runtime }: DriverPanelProps) {
  const drivers = Number(runtime.drivers ?? 0);
  const tone: StatusTone = drivers > 0 ? "success" : "warning";

  return (
    <StatusCard
      title="Drivers"
      value={drivers}
      description="Registered runtime drivers available to Mission Control."
      tone={tone}
      footer={
        <span>
          {drivers > 0
            ? `${drivers} driver${drivers === 1 ? "" : "s"} available`
            : "No runtime drivers detected"}
        </span>
      }
    />
  );
}

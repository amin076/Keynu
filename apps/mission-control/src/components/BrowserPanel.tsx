import StatusCard, { type StatusTone } from "./StatusCard.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type BrowserPanelProps = {
  runtime: RuntimeSnapshot;
};

export default function BrowserPanel({ runtime }: BrowserPanelProps) {
  const normalizedStatus = runtime.browser.trim().toLowerCase();
  const connected = normalizedStatus === "connected" || normalizedStatus === "online";
  const tone: StatusTone = connected ? "success" : "warning";

  return (
    <StatusCard
      title="Browser Agent"
      value={runtime.browser}
      description="Current connection state between Keynu and the controlled browser session."
      tone={tone}
      footer={
        <span>{connected ? "Browser communication available" : "Browser connection requires attention"}</span>
      }
    />
  );
}

import { Agent } from "./core/Agent.js";

async function main(): Promise<void> {
  const agent = new Agent();
  await agent.start();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

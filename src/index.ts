import { Agent } from "./core/Agent.js";

async function main() {

    const agent = new Agent();

    await agent.start();

}

main();
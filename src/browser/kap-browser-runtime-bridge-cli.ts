import { readFileSync } from "node:fs";
import { Command } from "commander";
import { processBrowserMessageForKapJobs } from "./kap-browser-runtime-bridge.js";

const program = new Command();

program
  .name("kap-browser-runtime-bridge")
  .description("Extract KAP jobs from a browser message, route them, and print KAP reports")
  .command("run")
  .argument("<messageFile>", "Text file containing an assistant message")
  .action(async (messageFile: string) => {
    const message = readFileSync(messageFile, "utf8");
    const reply = await processBrowserMessageForKapJobs(message, { dedupe: true });
    if (reply.trim().length > 0) {
      console.log(reply);
    }
  });

program.parseAsync(process.argv);

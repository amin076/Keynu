import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const fileOps = readFileSync("src/drivers/powershell/powershell-fileops.ts", "utf8");
const patch = readFileSync("src/drivers/powershell/powershell-patch.ts", "utf8");

assert(!fileOps.includes('result.args.join(" ")'));
assert(!patch.includes('(commandSpec.args ?? []).join(" ")'));
assert(!patch.includes('(payload.buildCommand.args ?? []).join(" ")'));
assert(fileOps.includes("formatCompactCommandFailure"));
assert(patch.includes("formatCompactCommandFailure"));

console.log("PowerShell compact error logging tests passed.");

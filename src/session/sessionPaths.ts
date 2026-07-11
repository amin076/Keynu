import { join } from "node:path";

export function getSessionDir(cwd = process.cwd()): string {
  return join(cwd, ".keynu", "session");
}

export function getSessionFilePath(cwd = process.cwd()): string {
  return join(getSessionDir(cwd), "session.json");
}

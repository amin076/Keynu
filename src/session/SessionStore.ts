import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getSessionDir, getSessionFilePath } from "./sessionPaths.js";
import { createDefaultSession } from "./createDefaultSession.js";
import type { KeynuSession, KeynuSessionPatch } from "./sessionTypes.js";

export class SessionStore {
  constructor(private readonly cwd = process.cwd()) {}

  read(): KeynuSession {
    const sessionPath = getSessionFilePath(this.cwd);

    if (!existsSync(sessionPath)) {
      return this.write(createDefaultSession());
    }

    try {
      const parsed = JSON.parse(readFileSync(sessionPath, "utf8")) as KeynuSession;
      return { ...createDefaultSession(), ...parsed };
    } catch {
      return this.write(createDefaultSession());
    }
  }

  patch(patch: KeynuSessionPatch): KeynuSession {
    const current = this.read();
    return this.write({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  write(session: KeynuSession): KeynuSession {
    mkdirSync(getSessionDir(this.cwd), { recursive: true });
    writeFileSync(getSessionFilePath(this.cwd), JSON.stringify(session, null, 2) + "\n", "utf8");
    return session;
  }
}

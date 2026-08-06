import { existsSync, readFileSync, unlinkSync } from 'node:fs';

import { PID_FILE } from './global-setup';

/** Stop the fixture website and worker started by global-setup. */
export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;

  try {
    const entries = JSON.parse(readFileSync(PID_FILE, 'utf8')) as Array<{
      label: string;
      pid?: number;
    }>;

    // Negative pid signals the whole process group, so the `npx` wrapper's
    // grandchild — the process actually holding the port — goes too.
    const signalGroup = (pid: number, signal: NodeJS.Signals) => {
      try {
        process.kill(-pid, signal);
      } catch {
        try {
          process.kill(pid, signal);
        } catch {
          // Already gone.
        }
      }
    };

    for (const entry of entries) {
      if (!entry.pid) continue;
      // SIGTERM so the worker performs its graceful shutdown.
      signalGroup(entry.pid, 'SIGTERM');
      console.log(`[e2e] Stopped ${entry.label} (pid ${entry.pid})`);
    }

    // Give the worker a moment to release any job it holds.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    for (const entry of entries) {
      if (!entry.pid) continue;
      signalGroup(entry.pid, 'SIGKILL');
    }
  } finally {
    try {
      unlinkSync(PID_FILE);
    } catch {
      // Nothing to clean up.
    }
  }
}

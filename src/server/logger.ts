import { readFileSync, mkdirSync, createWriteStream, type WriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export type LogLevel = 'debug' | 'info' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, error: 2 };

const configuredLevel: LogLevel = (() => {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env === 'debug' || env === 'info' || env === 'error') return env;
  return 'info';
})();

// Read version from package.json to avoid circular dependency with core.ts
const serverVersion: string = (() => {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

// File-based logging: write to .logs/server.log alongside stderr
const logStream: WriteStream | null = (() => {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const logsDir = join(__dirname, '..', '..', '.logs');
    mkdirSync(logsDir, { recursive: true });
    return createWriteStream(join(logsDir, 'server.log'), { flags: 'a' });
  } catch {
    return null;
  }
})();

/**
 * Structured JSON logger.
 *
 * Emits one JSON object per line to stderr and .logs/server.log.
 * Every entry includes server_version and timestamp automatically.
 */
export const logger = {
  info(event: Record<string, unknown>) {
    emit('info', event);
  },

  error(event: Record<string, unknown>) {
    emit('error', event);
  },

  debug(event: Record<string, unknown>) {
    emit('debug', event);
  },

  /** Returns true if the given level would be emitted. */
  isEnabled(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
  },
};

function emit(level: LogLevel, event: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[configuredLevel]) return;

  const entry = {
    level,
    ts: new Date().toISOString(),
    server_version: serverVersion,
    ...event,
  };

  const line = JSON.stringify(entry) + '\n';

  // Single JSON line to stderr (stdout is reserved for MCP transport)
  process.stderr.write(line);

  // Also write to .logs/server.log
  logStream?.write(line);
}

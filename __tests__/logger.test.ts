import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/server/logger.js';

describe('logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should emit structured JSON to stderr', () => {
    logger.info({ event: 'test_event', key: 'value' });

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = String(stderrSpy.mock.calls[0][0]);
    const parsed = JSON.parse(output.trim());

    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('test_event');
    expect(parsed.key).toBe('value');
    expect(parsed.ts).toBeDefined();
    expect(parsed.server_version).toBeDefined();
  });

  it('should include timestamp in ISO format', () => {
    logger.info({ event: 'ts_test' });

    const parsed = JSON.parse(String(stderrSpy.mock.calls[0][0]).trim());
    expect(() => new Date(parsed.ts)).not.toThrow();
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should emit error level', () => {
    logger.error({ event: 'err', error: 'something broke' });

    const parsed = JSON.parse(String(stderrSpy.mock.calls[0][0]).trim());
    expect(parsed.level).toBe('error');
    expect(parsed.error).toBe('something broke');
  });

  it('should emit one JSON line per call (newline terminated)', () => {
    logger.info({ event: 'a' });
    logger.info({ event: 'b' });

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    const line1 = String(stderrSpy.mock.calls[0][0]);
    const line2 = String(stderrSpy.mock.calls[1][0]);
    expect(line1.endsWith('\n')).toBe(true);
    expect(line2.endsWith('\n')).toBe(true);
  });

  it('should report isEnabled correctly for info level', () => {
    // Default LOG_LEVEL is info
    expect(logger.isEnabled('info')).toBe(true);
    expect(logger.isEnabled('error')).toBe(true);
  });
});

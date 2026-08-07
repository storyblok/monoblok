import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI } from './ui';

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ui', () => {
  describe('stderr routing', () => {
    it('should route ok() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.ok('done');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('done'));
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route info() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.info('details');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('details'));
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route warn() through console.warn (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.warn('caution');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('caution'));
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route error() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.error('broken');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('broken'));
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route title() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.title('My Title', '#00b3b0');
      expect(errorSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route log() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.log('raw text');
      expect(errorSpy).toHaveBeenCalledWith('raw text');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route list() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.list(['a', 'b']);
      expect(errorSpy).toHaveBeenCalledWith('  a');
      expect(errorSpy).toHaveBeenCalledWith('  b');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should route br() through console.error (stderr)', () => {
      const ui = new UI({ enabled: true });
      ui.br();
      expect(errorSpy).toHaveBeenCalledWith('');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('disabled mode', () => {
    it('should suppress decorative output when disabled but still show errors', () => {
      const ui = new UI({ enabled: false });
      ui.title('title', '#000');
      ui.ok('ok');
      ui.info('info');
      ui.warn('warn');
      ui.log('log');
      ui.list(['item']);
      ui.br();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      // Errors always reach stderr even when UI is disabled (critical for CI)
      ui.error('failure');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failure'));
    });

    it('should return a noop spinner when disabled', () => {
      const ui = new UI({ enabled: false });
      const spinner = ui.createSpinner('Loading');
      expect(spinner.elapsedTime).toBe(0);
      // Should not throw
      spinner.succeed('done');
      spinner.failed('oops');
    });

    it('should return a noop progress bar when disabled', () => {
      const ui = new UI({ enabled: false });
      const bar = ui.createProgressBar({ title: 'Loading' });
      // Should not throw
      bar.setTotal(10);
      bar.increment(1);
      bar.stop();
    });
  });

  describe('writeMachineOutput', () => {
    it('should write to stdout even when the UI is disabled', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      new UI({ enabled: false }).writeMachineOutput('{"ok":true}');
      expect(writeSpy).toHaveBeenCalledWith('{"ok":true}\n');
      expect(logSpy).not.toHaveBeenCalled();
    });

    // A reader that exits early (`… --format json | head -5`) closes the pipe
    // mid-write. Unhandled, that EPIPE crashed the process with exit code 1 and
    // buried the exit code the command had computed.
    it('should swallow an EPIPE on stdout', () => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      new UI({ enabled: true }).writeMachineOutput('{"ok":true}');

      const epipe: NodeJS.ErrnoException = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
      expect(() => process.stdout.emit('error', epipe)).not.toThrow();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    // Regression: the guard used to rethrow any non-EPIPE code from inside the
    // `'error'` listener. A throw in a listener is an uncaught exception, so it
    // reproduced exactly what the guard exists to prevent — stack trace, exit
    // code clobbered to 1 — for every code that is not EPIPE.
    it('should report a non-EPIPE stdout error instead of crashing', () => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      new UI({ enabled: true }).writeMachineOutput('{"ok":true}');

      const other: NodeJS.ErrnoException = Object.assign(new Error('write ENOSPC'), { code: 'ENOSPC' });
      expect(() => process.stdout.emit('error', other)).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('write ENOSPC'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('setEnabled', () => {
    it('should disable decorative output but keep errors on an initially enabled instance', () => {
      const ui = new UI({ enabled: true });
      ui.setEnabled(false);
      ui.ok('should not appear');
      ui.info('should not appear');
      ui.warn('should not appear');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();

      // Errors still reach stderr
      ui.error('visible error');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('visible error'));
    });

    it('should enable output on an initially disabled instance', () => {
      const ui = new UI({ enabled: false });
      ui.setEnabled(true);
      ui.ok('visible');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('visible'));
    });

    it('should be a no-op when the value matches the current state', () => {
      const ui = new UI({ enabled: true });
      ui.ok('before');
      const callCount = errorSpy.mock.calls.length;
      ui.setEnabled(true);
      ui.ok('after');
      // Only one additional call (the second ok), not a reset
      expect(errorSpy.mock.calls.length).toBe(callCount + 1);
    });
  });
});

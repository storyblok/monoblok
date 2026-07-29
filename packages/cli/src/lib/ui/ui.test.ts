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
    it('should produce no output when disabled', () => {
      const ui = new UI({ enabled: false });
      ui.title('title', '#000');
      ui.ok('ok');
      ui.info('info');
      ui.warn('warn');
      ui.error('error');
      ui.log('log');
      ui.list(['item']);
      ui.br();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
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

  describe('setEnabled', () => {
    it('should disable output on an initially enabled instance', () => {
      const ui = new UI({ enabled: true });
      ui.setEnabled(false);
      ui.ok('should not appear');
      ui.info('should not appear');
      ui.warn('should not appear');
      ui.error('should not appear');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
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

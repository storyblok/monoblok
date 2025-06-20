import chalk from 'chalk';
import { formatHeader, konsola } from './konsola';
import { describe, expect, it, vi } from 'vitest';

describe('konsola', () => {
  describe('title', () => {
    it('should prompt a title message', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      konsola.title('This is a test title', '#45bfb9');

      expect(consoleSpy).toHaveBeenCalledWith(formatHeader(chalk.bgHex('#45bfb9').bold.white(` This is a test title `)));
    });
  });
  describe('warn', () => {
    it('should prompt a warning message', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      konsola.warn('This is a test warning message');

      expect(consoleSpy).toHaveBeenCalledWith(`${chalk.yellow('⚠️ ')} This is a test warning message`);
    });

    it('should prompt a warning message with header', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      konsola.warn('This is a test warning message', true);
      const warnText = chalk.bgYellow.bold.black(` Warning `);

      expect(consoleSpy).toHaveBeenCalledWith(formatHeader(warnText,
      ));
    });
  });

  describe('success', () => {
    it('should prompt an success message', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      konsola.ok('Component A created succesfully');

      expect(consoleSpy).toHaveBeenCalledWith(`${chalk.green('✔')} Component A created succesfully`);
    });

    it('should prompt an success message with header', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      konsola.ok('Component A created succesfully', true);
      const successText = chalk.bgGreen.bold.white(` Success `);

      expect(consoleSpy).toHaveBeenCalledWith(formatHeader(successText));
    });
  });
  describe('error', () => {
    it('should prompt an error message', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      konsola.error('Oh gosh, this is embarrasing');
      const errorText = `${chalk.red.bold('▲ error')} Oh gosh, this is embarrasing`;
      expect(consoleSpy).toHaveBeenCalledWith(errorText, '');
    });

    it('should prompt an error message with header', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      konsola.error('Oh gosh, this is embarrasing', null, { header: true });
      const errorText = chalk.bgRed.bold.white(` Error `);

      expect(consoleSpy).toHaveBeenCalledWith(formatHeader(errorText));
    });

    it('should add a line break if margin set to true ', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      konsola.error('Oh gosh, this is embarrasing', null, { margin: true });
      expect(consoleSpy).toHaveBeenCalledWith('');
    });
  });
});

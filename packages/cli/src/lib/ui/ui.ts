import chalk from 'chalk';
import { MultiBar, Presets } from 'cli-progress';
import { Spinner } from '@topcli/spinner';
import { colorPalette } from '../../constants';
import { DEFAULT_GLOBAL_CONFIG } from '../config/defaults';
import { capitalize } from '../../utils/format';
import { isVitest } from '../../utils';

interface InfoOptions {
  header?: boolean;
  margin?: boolean;
}

interface ErrorOptions {
  header?: boolean;
  margin?: boolean;
}

export interface CLISpinner {
  succeed: (text?: string) => void;
  failed: (text?: string) => void;
  readonly elapsedTime: number;
}

export interface ProgressBar {
  increment: (count?: number) => void;
  setTotal: (total: number) => void;
  stop: () => void;
}

const noopProgressBar: ProgressBar = {
  increment: () => {},
  setTotal: () => {},
  stop: () => {},
};

const noopSpinner: CLISpinner = {
  failed: (_title?: string) => {},
  succeed: (_title?: string) => {},
  elapsedTime: 0,
};

export class UI {
  private console: Pick<typeof console, 'log' | 'info' | 'warn' | 'error'> | null;
  private enabled: boolean;
  private multiBar: MultiBar | null;

  constructor({ enabled }: { enabled: boolean }) {
    this.enabled = enabled;
    this.console = null;
    this.multiBar = null;
    this.applyEnabled(enabled);
  }

  /** Update the enabled state (called by getUI when preAction resolves config). */
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) { return; }
    this.applyEnabled(enabled);
  }

  private applyEnabled(enabled: boolean) {
    this.enabled = enabled;
    // Redirect all output to stderr. We wrap the global console methods instead
    // of using `new console.Console(process.stderr)` so test spies on the global
    // console object still capture output.
    this.console = enabled
      ? {
          log: (...args: unknown[]) => console.error(...args),
          info: (...args: unknown[]) => console.error(...args),
          warn: (...args: unknown[]) => console.warn(...args),
          error: (...args: unknown[]) => console.error(...args),
        }
      : null;
    this.multiBar = enabled
      ? new MultiBar({
        clearOnComplete: false,
        format: `${chalk.bold(' {title} ')} ${chalk.hex(colorPalette.PRIMARY)('[{bar}]')} {percentage}% | {eta_formatted} | {value}/{total} processed`,
        etaBuffer: 60,
      }, Presets.rect)
      : null;
  }

  title(message: string, color: string, subtitle?: string) {
    if (subtitle) {
      this.console?.log(`${chalk.bgHex(color).bold(` ${capitalize(message)} `)} ${subtitle}`);
    }
    else {
      this.console?.log(chalk.bgHex(color).bold(` ${capitalize(message)} `));
    }
    this.br();
    this.br();
  }

  br() {
    this.console?.log('');
  }

  ok(message?: string, header: boolean = false) {
    if (header) {
      this.br();
      const successHeader = chalk.bgGreen.bold.white(` Success `);
      this.console?.log(successHeader);
      this.br();
    }

    this.console?.log(message ? `${chalk.green('✔')} ${message}` : '');
  }

  info(message: string, options: InfoOptions = {}) {
    const { header = false, margin = true } = options;
    if (header) {
      this.br();
      const infoHeader = chalk.bgBlue.bold.white(` Info `);
      this.console?.info(infoHeader);
    }

    this.console?.info(message ? `${chalk.blue('ℹ')} ${message}` : '');
    if (margin) {
      this.br();
    }
  }

  warn(message?: string, header: boolean = false) {
    if (header) {
      this.br();
      const warnHeader = chalk.bgYellow.bold.black(` Warning `);
      this.console?.warn(warnHeader);
    }

    this.console?.warn(message ? `${chalk.yellow('⚠️ ')} ${message}` : '');
  }

  error(message: string, info?: unknown, options: ErrorOptions = {}) {
    const { header = false, margin = false } = options;
    // Errors always go to stderr, even when UI is disabled (e.g. --no-ui-enabled in CI).
    const out = this.console ?? { error: (...args: unknown[]) => console.error(...args), log: (...args: unknown[]) => console.error(...args) };
    if (header) {
      const errorHeader = chalk.bgRed.bold.white(` Error `);
      out.error(errorHeader);
      out.log('');
    }

    if (info) {
      out.error(`${chalk.red.bold('▲ error')} ${message}`, info);
    }
    else {
      out.error(`${chalk.red.bold('▲ error')} ${message}`);
    }
    if (margin) {
      out.log('');
    }
  }

  /** Plain console.log passthrough — use for preformatted or multi-line text. */
  log(message: string) {
    this.console?.log(message);
  }

  /**
   * Writes machine-readable output straight to stdout, bypassing the UI enable
   * gate. Decorative output is suppressed alongside it (see `--format json`), so
   * stdout stays a single pipeable document even with `--no-ui-enabled`.
   */
  writeMachineOutput(payload: string) {
    process.stdout.write(`${payload}\n`);
  }

  list(items: string[]) {
    for (const item of items) {
      this.console?.log(`  ${item}`);
    }
  }

  createProgressBar(options: { title: string }): ProgressBar {
    const bar = this.multiBar?.create(0, 0, options);
    if (!bar) { return noopProgressBar; }
    // cli-progress only substitutes payload tokens ({title}) when the payload is
    // passed alongside the update. Keep forwarding the original options on every call.
    return {
      increment: (count = 1) => bar.increment(count, options),
      // cli-progress renders `{eta_formatted}` as "LLs" when total is 0.
      // Floor at 1 so an empty phase stays a clean 0/1 instead.
      setTotal: (total) => { bar.setTotal(Math.max(total, 1)); bar.update(options); },
      stop: () => bar.stop(),
    };
  }

  stopAllProgressBars() {
    this.multiBar?.stop();
  }

  createSpinner(title: string): CLISpinner {
    if (!this.enabled) { return noopSpinner; }
    const spinner = new Spinner({ verbose: !isVitest });
    spinner.stream = process.stderr;
    return spinner.start(title);
  }
}

/** Pass as the 2nd argument to all @inquirer/prompts calls so prompts render on stderr. */
export const stderrPromptContext = { output: process.stderr } as const;

let uiInstance: UI | null = null;

export function getUI(options?: { enabled: boolean }) {
  if (!uiInstance) {
    uiInstance = new UI(options ?? { enabled: DEFAULT_GLOBAL_CONFIG.ui.enabled });
  }
  else if (options !== undefined) {
    uiInstance.setEnabled(options.enabled);
  }

  return uiInstance;
}

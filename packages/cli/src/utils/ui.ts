import chalk from 'chalk';
import { MultiBar, Presets } from 'cli-progress';
import { Spinner } from '@topcli/spinner';
import { colorPalette } from '../constants';
import { capitalize } from './format';
import { isVitest } from './';

const noopProgressBar = {
  increment: () => {},
  setTotal: (_n: number) => {},
  stop: () => {},
};
const noopSpinner = {
  failed: (_title: string) => {},
  succeed: (_title: string) => {},
};

export class UI {
  private console: typeof console | null;
  private enabled: boolean;
  private multiBar: MultiBar | null;

  constructor({ enabled }: { enabled: boolean }) {
    this.console = enabled ? console : null;
    this.enabled = enabled;
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

  info(message: string, options = {
    header: false,
    margin: true,
  }) {
    if (options.header) {
      this.br();
      const infoHeader = chalk.bgBlue.bold.white(` Info `);
      this.console?.info(infoHeader);
    }

    this.console?.info(message ? `${chalk.blue('ℹ')} ${message}` : '');
    if (options.margin) {
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

  error(message: string, info?: unknown, options = {
    header: false,
    margin: false,
  }) {
    if (options.header) {
      const errorHeader = chalk.bgRed.bold.white(` Error `);
      this.console?.error(errorHeader);
      this.br();
    }

    this.console?.error(`${chalk.red.bold('▲ error')} ${message}`, info || '');
    if (options.margin) {
      this.br();
    }
  }

  list(items: string[]) {
    for (const item of items) {
      this.console?.log(`  ${item}`);
    }
  }

  createProgressBar(options: { title: string }) {
    return this.multiBar?.create(0, 0, options) || noopProgressBar;
  }

  stopAllProgressBars() {
    this.multiBar?.stop();
  }

  createSpinner(title: string) {
    if (this.enabled) {
      return new Spinner({
        verbose: !isVitest,
      }).start(title);
    }
    return noopSpinner;
  }
}

let uiInstance: UI | null = null;

export function getUI(options: { enabled: boolean } = { enabled: false }) {
  if (!uiInstance) {
    uiInstance = new UI(options);
  }

  return uiInstance;
}

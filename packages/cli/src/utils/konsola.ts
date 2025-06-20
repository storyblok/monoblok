import chalk from 'chalk';

export interface KonsolaFormatOptions {
  header?: boolean;
  margin?: boolean;
}

export function formatHeader(title: string) {
  return `${title}`;
}
export const konsola = {
  title: (message: string, color: string, subtitle?: string) => {
    if (subtitle) {
      console.log(`${formatHeader(chalk.bgHex(color).bold(` ${message} `))} ${subtitle}`);
    }
    else {
      console.log(formatHeader(chalk.bgHex(color).bold(` ${message} `)));
    }
    console.log(''); // Add a line break
    console.log(''); // Add a line break
  },
  br: () => {
    console.log(''); // Add a line break
  },
  ok: (message?: string, header: boolean = false) => {
    if (header) {
      console.log(''); // Add a line break
      const successHeader = chalk.bgGreen.bold.white(` Success `);
      console.log(formatHeader(successHeader));
      console.log(''); // Add a line break
    }

    console.log(message ? `${chalk.green('✔')} ${message}` : '');
  },
  info: (message: string, options: KonsolaFormatOptions = {
    header: false,
    margin: true,
  }) => {
    if (options.header) {
      console.log(''); // Add a line break
      const infoHeader = chalk.bgBlue.bold.white(` Info `);
      console.log(formatHeader(infoHeader));
    }

    console.log(message ? `${chalk.blue('ℹ')} ${message}` : '');
    if (options.margin) {
      console.error(''); // Add a line break
    }
  },
  warn: (message?: string, header: boolean = false) => {
    if (header) {
      console.log(''); // Add a line break
      const warnHeader = chalk.bgYellow.bold.black(` Warning `);
      console.warn(formatHeader(warnHeader));
    }

    console.warn(message ? `${chalk.yellow('⚠️ ')} ${message}` : '');
  },
  error: (message: string, info?: unknown, options?: KonsolaFormatOptions) => {
    if (options?.header) {
      const errorHeader = chalk.bgRed.bold.white(` Error `);
      console.error(formatHeader(errorHeader));
      console.log(''); // Add a line break
    }

    console.error(`${chalk.red.bold('▲ error')} ${message}`, info || '');
    if (options?.margin) {
      console.error(''); // Add a line break
    }
  },
};

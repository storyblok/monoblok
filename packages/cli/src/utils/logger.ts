export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogContextValue[]
  | { [key: string]: LogContextValue };

export interface LogContext {
  [key: string]: LogContextValue;
}

export interface LogRecord {
  timestamp?: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

export interface LogTransport {
  enabled?: boolean;
  level?: LogLevel;
  log: (record: LogRecord) => void;
}

export interface LoggerOptions {
  context?: LogContext;
  level?: LogLevel;
  transports?: LogTransport[];
}

export class Logger {
  public transports: LogTransport[] = [];
  public context: LogContext = {};
  public level: LogLevel = 'info';

  constructor(options?: LoggerOptions) {
    if (options?.transports) { this.transports = options.transports; }
    if (options?.context) { this.context = options.context; }
    if (options?.level) { this.level = options.level; }
  }

  public log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date();
    const mergedContext = structuredClone(context
      ? { ...this.context, ...context }
      : this.context);

    const record: LogRecord = {
      timestamp,
      level,
      message,
      context: Object.keys(mergedContext).length ? mergedContext : undefined,
    };

    for (const transport of this.transports) {
      transport.log(record);
    }
  }

  public error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
}

let loggerInstance: Logger | null = null;

export function getLogger(options?: LoggerOptions) {
  if (!loggerInstance && options) {
    loggerInstance = new Logger(options);
  }
  else if (!loggerInstance) {
    throw new Error('Logger not initialized. Call getLogger with options first.');
  }

  return loggerInstance;
}

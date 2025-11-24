export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
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
  transports?: LogTransport[];
}

export class Logger {
  public transports: LogTransport[] = [];
  public context: LogContext = {};

  constructor(options?: LoggerOptions) {
    if (options?.transports) { this.transports = options.transports; }
    if (options?.context) { this.context = options.context; }
  }

  public log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date();
    const mergedContext = context
      ? { ...this.context, ...context }
      : this.context;

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
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }

  return loggerInstance;
}

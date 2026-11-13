export type LogLevel = "error" | "warn" | "info" | "debug";

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
  private hasReportedTransportError = false;

  constructor(options?: LoggerOptions) {
    if (options?.transports) {
      this.transports = options.transports;
    }
    if (options?.context) {
      this.context = options.context;
    }
  }

  public setTransports(transports: LogTransport[]): void {
    this.transports = transports;
    this.hasReportedTransportError = false;
  }

  public log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date();
    const mergedContext = context ? { ...this.context, ...context } : this.context;

    const record: LogRecord = {
      timestamp,
      level,
      message,
      context: Object.keys(mergedContext).length ? mergedContext : undefined,
    };

    for (const transport of this.transports) {
      // Logging is best effort: a failing transport (e.g. a full disk) must
      // never break the command, nor keep the other transports from logging.
      try {
        transport.log(record);
      } catch (error) {
        this.reportTransportError(error);
      }
    }
  }

  private reportTransportError(error: unknown): void {
    if (this.hasReportedTransportError) {
      return;
    }
    this.hasReportedTransportError = true;
    try {
      const reason = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Logging failed, some log entries may be missing: ${reason}\n`);
    } catch {
      // Nothing left to report to.
    }
  }

  public error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
}

let loggerInstance: Logger | null = null;

export function getLogger(options?: LoggerOptions) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }

  return loggerInstance;
}

export function setLoggerTransports(transports: LogTransport[]) {
  if (loggerInstance) {
    loggerInstance.setTransports(transports);
  }
}

export function resetLogger() {
  loggerInstance = null;
}

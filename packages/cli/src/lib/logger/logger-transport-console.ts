import { APIError } from '../../utils/error';
import type { LogContext, LogLevel, LogRecord, LogTransport } from './logger';

export interface ConsoleTransportOptions {
  level?: LogLevel;
}

export class ConsoleTransport implements LogTransport {
  public level: LogLevel;

  constructor(options?: ConsoleTransportOptions) {
    this.level = options?.level ?? 'info';
  }

  public log(record: LogRecord): void {
    if (!this.shouldLog(record.level)) {
      return;
    }

    const line = this.format(record);
    switch (record.level) {
      case 'error':
        (console.error ?? console.log).call(console, line);
        break;
      case 'warn':
        (console.warn ?? console.log).call(console, line);
        break;
      case 'info':
        (console.info ?? console.log).call(console, line);
        break;
      case 'debug':
        (console.debug ?? console.log).call(console, line);
        break;
    }
  }

  private levelRank(level: LogLevel): number {
    switch (level) {
      case 'error':
        return 0;
      case 'warn':
        return 1;
      case 'info':
        return 2;
      case 'debug':
        return 3;
      default:
        return 3;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelRank(level) <= this.levelRank(this.level);
  }

  private format(record: LogRecord): string {
    const timestamp = this.formatTimestamp(record.timestamp ?? new Date());
    const level = record.level.toUpperCase().padEnd(5, ' ');
    const message = record.message.replaceAll('\n', '\\n');
    const context = record.context ? this.formatContext(record.context) : '';
    return `[${timestamp}]  ${level}  ${message}${context}`;
  }

  private formatTimestamp(date: Date): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const pad3 = (n: number) => String(n).padStart(3, '0');
    const h = pad2(date.getHours());
    const m = pad2(date.getMinutes());
    const s = pad2(date.getSeconds());
    const ms = pad3(date.getMilliseconds());
    return `${h}:${m}:${s}.${ms}`;
  }

  private formatContext(context: LogContext): string {
    const entries = Object.entries(context);
    if (entries.length === 0) { return ''; }
    const parts = entries.map(([k, v]) => `${k}: ${this.stringify(v)}`);
    return `  (${parts.join(', ')})`;
  }

  private stringify(value: unknown): string {
    try {
      if (value instanceof APIError) {
        return JSON.stringify({
          name: value.name,
          message: value.message,
          httpCode: value.code,
          httpStatusText: value.error?.response.statusText,
          stack: value.stack,
        });
      }
      if (value instanceof Error) {
        return JSON.stringify({
          name: value.name,
          message: value.message,
          stack: value.stack,
        });
      }
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    }
    catch {
      return '[unserializable]';
    }
  }
}

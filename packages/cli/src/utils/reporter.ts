import { saveToFileSync } from './filesystem';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

export const REPORT_STATUS = {
  unfinished: 'UNFINISHED',
  success: 'SUCCESS',
  partialSuccess: 'PARTIAL_SUCCESS',
  failure: 'FAILURE',
} as const;

export interface Report {
  status: typeof REPORT_STATUS[keyof typeof REPORT_STATUS];
  meta: {
    command?: string;
    cliVersion?: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
    config?: Record<string, unknown>;
  } & Record<string, unknown>;
  summary: Record<string, {
    total: number;
    succeeded: number;
    skipped?: number;
    failed: number;
  }>;
}

export interface ReporterOptions {
  enabled?: boolean;
  filePath?: string;
  maxFiles?: number;
}

export class Reporter {
  public filePath: string;
  private enabled: boolean;
  private startedAt: Date = new Date();
  private maxFiles?: number;
  private report: Report = {
    status: REPORT_STATUS.unfinished,
    meta: {
      startedAt: this.startedAt.toISOString(),
    },
    summary: {},
  };

  constructor(options?: ReporterOptions) {
    this.enabled = options?.enabled || false;
    this.filePath = options?.filePath ?? `./${Date.now()}.json`;
    this.maxFiles = options?.maxFiles;
  }

  public addMeta(key: keyof Report['meta'], value: Report['meta'][typeof key]) {
    this.report.meta[key] = value;
    return this;
  }

  public addSummary(key: keyof Report['summary'], value: Report['summary'][typeof key]) {
    this.report.summary[key] = value;
    return this;
  }

  public finalize() {
    if (!this.enabled) {
      return;
    }

    const endedAt = new Date();
    this.report.meta.endedAt = endedAt.toISOString();
    this.report.meta.durationMs = endedAt.getTime() - this.startedAt.getTime();
    this.updateStatus();

    saveToFileSync(this.filePath, JSON.stringify(this.report, null, 2));

    if (this.maxFiles !== undefined) {
      this.pruneOldFiles();
    }
  }

  private updateStatus() {
    const succeededTotal = Object.values(this.report.summary).reduce((acc, curr) => acc + curr.succeeded, 0);
    const failedTotal = Object.values(this.report.summary).reduce((acc, curr) => acc + curr.failed, 0);

    if (succeededTotal > 0 && failedTotal > 0) {
      this.report.status = REPORT_STATUS.partialSuccess;
      return;
    }
    else if (succeededTotal > 0) {
      this.report.status = REPORT_STATUS.success;
      return;
    }

    this.report.status = REPORT_STATUS.failure;
  }

  private pruneOldFiles(): void {
    if (this.maxFiles === undefined) {
      return;
    }

    const dir = dirname(this.filePath);
    const ext = extname(this.filePath);

    Reporter.pruneReportFiles(dir, this.maxFiles, ext);
  }

  public static pruneReportFiles(
    directory: string,
    keep: number,
    extension = '.json',
  ) {
    if (!existsSync(directory)) {
      return 0;
    }

    const files = readdirSync(directory)
      .filter(file => extname(file) === extension)
      .sort();

    const filesToDelete = files.length - keep;
    if (filesToDelete <= 0) {
      return 0;
    }

    for (const file of files.slice(0, filesToDelete)) {
      unlinkSync(join(directory, file));
    }

    return filesToDelete;
  }

  public static listReportFiles(
    directory: string,
    extension = '.json',
  ) {
    if (!existsSync(directory)) {
      return [];
    }

    return readdirSync(directory)
      .filter(file => extname(file) === extension)
      .map(f => relative(process.cwd(), join(directory, f)))
      .sort();
  }
}

let reporterInstance: Reporter | null = null;

export function getReporter(options?: ReporterOptions) {
  if (!reporterInstance) {
    reporterInstance = new Reporter(options);
  }

  return reporterInstance;
}

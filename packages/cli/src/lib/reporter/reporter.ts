import {
  listRunFiles,
  pruneRunFiles,
  pruneSiblingRunFiles,
  saveToFileSync,
} from "../../utils/filesystem";
import { join, relative } from "pathe";

export const REPORT_STATUS = {
  unfinished: "UNFINISHED",
  success: "SUCCESS",
  partialSuccess: "PARTIAL_SUCCESS",
  failure: "FAILURE",
} as const;

export interface Report {
  status: (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];
  meta: {
    command?: string;
    cliVersion?: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
    config?: Record<string, unknown>;
  } & Record<string, unknown>;
  summary: Record<
    string,
    {
      total: number;
      succeeded: number;
      skipped?: number;
      failed: number;
    }
  >;
}

export interface ReporterOptions {
  enabled?: boolean;
  filePath?: string;
  maxFiles?: number;
}

export class Reporter {
  public static readonly FILE_EXTENSION = ".json";
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
    this.filePath = options?.filePath ?? `./${Date.now()}${Reporter.FILE_EXTENSION}`;
    this.maxFiles = options?.maxFiles;
  }

  public addMeta(key: keyof Report["meta"], value: Report["meta"][typeof key]) {
    this.report.meta[key] = value;
    return this;
  }

  public addSummary(key: keyof Report["summary"], value: Report["summary"][typeof key]) {
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
      pruneSiblingRunFiles(this.filePath, this.maxFiles);
    }
  }

  private updateStatus() {
    let succeededTotal = 0;
    let failedTotal = 0;

    for (const item of Object.values(this.report.summary)) {
      succeededTotal += item.succeeded;
      failedTotal += item.failed;
    }

    if (failedTotal === 0) {
      this.report.status = REPORT_STATUS.success;
    } else if (succeededTotal > 0) {
      this.report.status = REPORT_STATUS.partialSuccess;
    } else {
      this.report.status = REPORT_STATUS.failure;
    }
  }

  public static pruneReportFiles(directory: string, keep: number): number {
    return pruneRunFiles(directory, Reporter.FILE_EXTENSION, keep);
  }

  public static listReportFiles(directory: string): string[] {
    return listRunFiles(directory, Reporter.FILE_EXTENSION).map((file) =>
      relative(process.cwd(), join(directory, file)),
    );
  }
}

let reporterInstance: Reporter | null = null;

export function getReporter(options?: ReporterOptions) {
  if (!reporterInstance) {
    reporterInstance = new Reporter(options);
  }

  return reporterInstance;
}

export function resetReporter() {
  reporterInstance = null;
}

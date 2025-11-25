import { beforeEach, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { REPORT_STATUS, Reporter } from './reporter';

vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  vol.reset();
});

it('should compute status and write report when enabled', () => {
  const reporterSuccess = new Reporter({ enabled: true, filePath: './success.json' });
  reporterSuccess.addSummary('jobs', { total: 3, succeeded: 3, failed: 0 });
  reporterSuccess.finalize();

  const reporterSuccessSkipped = new Reporter({ enabled: true, filePath: './success-skipped.json' });
  reporterSuccessSkipped.addSummary('jobs', { total: 3, succeeded: 0, skipped: 3, failed: 0 });
  reporterSuccessSkipped.finalize();

  const reporterPartial = new Reporter({ enabled: true, filePath: './partial.json' });
  reporterPartial.addSummary('jobs', { total: 3, succeeded: 2, failed: 1 });
  reporterPartial.finalize();

  const reporterFailure = new Reporter({ enabled: true, filePath: './failure.json' });
  reporterFailure.addSummary('jobs', { total: 2, succeeded: 0, failed: 2 });
  reporterFailure.finalize();

  const files = vol.toJSON();

  // Success
  const success = JSON.parse(files[Object.keys(files).find(k => k.includes('success.json'))!] as string);
  expect(success.status).toBe(REPORT_STATUS.success);
  expect(success.summary.jobs).toEqual({ total: 3, succeeded: 3, failed: 0 });

  // Success (all skipped)
  const successSkipped = JSON.parse(files[Object.keys(files).find(k => k.includes('success-skipped.json'))!] as string);
  expect(successSkipped.status).toBe(REPORT_STATUS.success);
  expect(successSkipped.summary.jobs).toEqual({ total: 3, succeeded: 0, skipped: 3, failed: 0 });

  // Partial success
  const partial = JSON.parse(files[Object.keys(files).find(k => k.includes('partial.json'))!] as string);
  expect(partial.status).toBe(REPORT_STATUS.partialSuccess);
  expect(partial.summary.jobs).toEqual({ total: 3, succeeded: 2, failed: 1 });

  // Failure
  const failure = JSON.parse(files[Object.keys(files).find(k => k.includes('failure.json'))!] as string);
  expect(failure.status).toBe(REPORT_STATUS.failure);
  expect(failure.summary.jobs).toEqual({ total: 2, succeeded: 0, failed: 2 });
});

it('should only keep n number of report files', () => {
  const maxFiles = 3;

  const mk = (n: number) => {
    const r = new Reporter({ enabled: true, filePath: `./${n}.json`, maxFiles });
    r.finalize();
  };

  mk(1);
  mk(2);
  mk(3);
  mk(4);
  mk(5);

  const files = Object.keys(vol.toJSON());
  expect(files).toHaveLength(maxFiles);
  // Oldest files (1.json, 2.json) should be gone
  expect(files.some(f => f.endsWith('/1.json') || f.endsWith('\\1.json') || f.endsWith('1.json'))).toBe(false);
  expect(files.some(f => f.endsWith('/2.json') || f.endsWith('\\2.json') || f.endsWith('2.json'))).toBe(false);
  // Newest files (3.json, 4.json, 5.json) should remain
  expect(files.some(f => f.endsWith('/3.json') || f.endsWith('\\3.json') || f.endsWith('3.json'))).toBe(true);
  expect(files.some(f => f.endsWith('/4.json') || f.endsWith('\\4.json') || f.endsWith('4.json'))).toBe(true);
  expect(files.some(f => f.endsWith('/5.json') || f.endsWith('\\5.json') || f.endsWith('5.json'))).toBe(true);
});

it('should not write a report when disabled', () => {
  const reporter = new Reporter({ enabled: false, filePath: './disabled.json' });
  reporter.finalize();

  const files = Object.keys(vol.toJSON());
  expect(files).toHaveLength(0);
});

import chalk from 'chalk';
import { konsola } from '../../../utils/konsola';

export type ProcessingEvent =
  | { type: 'start'; total: number }
  | { type: 'success'; name: string; resourceType: string; color: string; elapsedMs?: number }
  | { type: 'skip'; name: string; resourceType: string; elapsedMs?: number }
  | { type: 'error'; name: string; resourceType: string; error: unknown; elapsedMs?: number }
  | { type: 'complete'; summary: { updated: number; unchanged: number; failed: number } };

export class ProgressDisplay {
  public total = 0;
  private processed = 0;
  private updated = 0;
  private unchanged = 0;
  private failed = 0;
  private currentProgressLine = '';
  // Track start time for calculating elapsed time on completion
  private startTime: number | null = null;

  start(total: number) {
    this.total = total;
    this.processed = 0;
    this.updated = 0;
    this.unchanged = 0;
    this.failed = 0;
    // Record the start time when processing begins
    this.startTime = Date.now();
    konsola.br();
    console.log(`Processing ${total} resources...`);
    this.updateProgress();
  }

  handleEvent(event: ProcessingEvent) {
    switch (event.type) {
      case 'start':
        this.start(event.total);
        break;

      case 'success': {
        this.processed++;
        this.updated++;
        this.clearProgress();
        const successTimeString = event.elapsedMs ? chalk.dim(` (${this.formatElapsedTime(event.elapsedMs)})`) : '';
        console.log(`${chalk.green('✓')} ${this.capitalize(event.resourceType)}→ ${chalk.hex(event.color)(event.name)} - Updated${successTimeString}`);
        this.updateProgress();
        break;
      }

      case 'skip': {
        this.processed++;
        this.unchanged++;
        // Optionally show timing for skipped items if they take longer than expected
        const skipTimeString = event.elapsedMs && event.elapsedMs > 10 ? chalk.dim(` (${this.formatElapsedTime(event.elapsedMs)})`) : '';
        if (skipTimeString) {
          this.clearProgress();
          console.log(`${chalk.dim('—')} ${this.capitalize(event.resourceType)}→ ${chalk.dim(event.name)} - Skipped${skipTimeString}`);
        }
        this.updateProgress();
        break;
      }

      case 'error': {
        this.processed++;
        this.failed++;
        this.clearProgress();
        const errorTimeString = event.elapsedMs ? chalk.dim(` (${this.formatElapsedTime(event.elapsedMs)})`) : '';
        console.log(`${chalk.red('✗')} ${this.capitalize(event.resourceType)}→ ${chalk.red(event.name)} - Failed${errorTimeString}`);
        this.updateProgress();
        break;
      }

      case 'complete': {
        this.clearProgress();
        const { updated, unchanged, failed } = event.summary;

        // Calculate elapsed time if startTime was recorded
        const elapsedTime = this.startTime ? Date.now() - this.startTime : null;
        const timeString = elapsedTime ? this.formatElapsedTime(elapsedTime) : '';

        konsola.ok(`Completed: ${updated} updated, ${unchanged} unchanged, ${failed} failed${timeString ? ` in ${timeString}` : ''}`, true);
        konsola.br();
        // Show summary of skipped items when there are many
        if (unchanged > 5) {
          console.log(chalk.dim(`   (${unchanged} resources were already up-to-date)`));
        }
        break;
      }
    }
  }

  private updateProgress() {
    this.currentProgressLine = `[${this.processed}/${this.total}] ${this.updated} updated, ${this.unchanged} unchanged, ${this.failed} failed`;
    process.stdout.write(`\r${this.currentProgressLine}`);
  }

  clearProgress() {
    if (this.currentProgressLine) {
      process.stdout.write(`\r${' '.repeat(this.currentProgressLine.length)}\r`);
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Formats elapsed time in milliseconds to a human-readable string
   * @param ms - Time in milliseconds
   * @returns Formatted time string (e.g., "1.2s", "2m 30s", "1h 5m")
   */
  private formatElapsedTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    // For times under a minute, show decimal precision for seconds
    const preciseSeconds = (ms / 1000).toFixed(1);
    return `${preciseSeconds}s`;
  }
}

// Global display instance - single source of truth for terminal output
export const progressDisplay = new ProgressDisplay();

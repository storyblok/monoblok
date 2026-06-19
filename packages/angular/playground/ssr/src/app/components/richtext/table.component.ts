import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { type SbAngularRichTextProps, SbRichTextComponent } from '@storyblok/angular';
import { splitTableRows } from '@storyblok/richtext';

/**
 * Custom table component demonstrating proper thead/tbody separation.
 * Uses splitTableRows to separate header rows from body rows.
 */
@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table>
      @if (tableRows().headerRows.length > 0) {
        <thead>
          <sb-rich-text [sbDocument]="tableRows().headerRows" />
        </thead>
      }
      @if (tableRows().bodyRows.length > 0) {
        <tbody>
          <sb-rich-text [sbDocument]="tableRows().bodyRows" />
        </tbody>
      }
    </table>
  `,
  host: { style: 'display: contents' },
  imports: [SbRichTextComponent],
})
export class TableComponent {
  readonly data = input.required<SbAngularRichTextProps<'table'>>();

  /** Split rows into header (thead) and body (tbody) sections */
  readonly tableRows = computed(() => splitTableRows(this.data().content));
}

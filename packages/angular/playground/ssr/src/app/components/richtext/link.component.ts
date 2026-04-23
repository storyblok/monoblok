import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // imports: [SbRichTextComponent],
  template: `
    <div>
      <h2>This is custom link</h2>
      <!-- @if (blok().text) {
        <sb-rich-text [doc]="blok().text!" />
      } -->
    </div>
  `,
})
export class LinkComponent {}

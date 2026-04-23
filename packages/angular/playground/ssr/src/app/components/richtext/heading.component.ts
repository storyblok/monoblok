import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type RichTextComponentProps, SbRichTextComponent } from '@storyblok/angular';

@Component({
  selector: 'app-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      @for (doc of data().content ?? []; track doc) {
        <sb-rich-text [doc]="doc" />
      }
    </p>
  `,
  host: { style: 'display: contents' },
  imports: [SbRichTextComponent],
})
export class HeadingComponent {
  readonly data = input.required<RichTextComponentProps<'heading'>>();
}

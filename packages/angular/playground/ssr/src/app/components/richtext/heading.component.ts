import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { type SbAngularRichTextProps, SbRichTextComponent } from '@storyblok/angular';

/**
 * Custom heading component demonstrating dynamic heading levels.
 * The heading level (h1-h6) is determined from the node's attrs.level property.
 */
@Component({
  selector: 'app-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (level()) {
      @case (1) { <h1><sb-rich-text [sbDocument]="data().content" /></h1> }
      @case (2) { <h2><sb-rich-text [sbDocument]="data().content" /></h2> }
      @case (3) { <h3><sb-rich-text [sbDocument]="data().content" /></h3> }
      @case (4) { <h4><sb-rich-text [sbDocument]="data().content" /></h4> }
      @case (5) { <h5><sb-rich-text [sbDocument]="data().content" /></h5> }
      @case (6) { <h6><sb-rich-text [sbDocument]="data().content" /></h6> }
    }
  `,
  host: { style: 'display: contents' },
  imports: [SbRichTextComponent],
})
export class HeadingComponent {
  readonly data = input.required<SbAngularRichTextProps<'heading'>>();

  /** Extract the heading level (1-6) from attrs, defaulting to 1 */
  readonly level = computed(() => this.data().attrs?.level ?? 1);
}

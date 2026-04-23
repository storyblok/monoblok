import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { SbRichTextComponent, type RichTextComponentProps } from '@storyblok/angular';

@Component({
  selector: 'app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent],
  template: `
    <div>
      <h2>Custom Link Component</h2>
    </div>
  `,
})
export class LinkComponent {
  readonly node = input.required<RichTextComponentProps<'heading'>>();

  ngOnInit(): void {
    console.log(this.node());
  }
}

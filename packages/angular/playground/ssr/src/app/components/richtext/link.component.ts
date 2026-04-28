import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type RichTextComponentProps } from '@storyblok/angular';

@Component({
  selector: 'app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="data().attrs?.href" target="_blank" rel="noopener">
      <ng-content />
    </a>
  `,
  host: { style: 'display: inline-block' },
})
export class LinkComponent {
  readonly data = input.required<RichTextComponentProps<'link'>>();
}

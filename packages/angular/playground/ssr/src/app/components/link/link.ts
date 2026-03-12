import { Component, ChangeDetectionStrategy, input, computed, effect } from '@angular/core';
import { SbRichTextNodeComponent, type AngularRenderNode } from '@storyblok/angular';

interface LinkProps {
  href?: string;
  target?: string;
  linktype?: string;
  children?: AngularRenderNode[];
  [key: string]: unknown;
}

@Component({
  selector: 'app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextNodeComponent],
  template: `
    <a [href]="props().href" [target]="props().target">
      <sb-rich-text-node [nodes]="props().children!" />
    </a>
  `,
})
export class LinkComponent {
  readonly props = input<LinkProps>({});

  // constructor() {
  //   effect(() => {
  //     console.log('Link props', this.props());
  //   });
  // }
}

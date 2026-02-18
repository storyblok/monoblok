import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <p>This is the page componnet</p>
    </div>
  `,
})
export class PageComponent {}

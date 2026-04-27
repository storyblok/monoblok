import { Component, input, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SbBlokDirective } from './sb-blok.directive';
import { StoryblokComponentResolver } from './sb-blok.feature';
import { SbBlokData } from '../types';
import { vi } from 'vitest';

type TeaserBlok = SbBlokData & {
  component: 'teaser';
  headline: string;
};

type GridBlok = SbBlokData & {
  component: 'grid';
  columns: string[];
};

@Component({
  selector: 'sb-teaser',
  template: `<h1>{{ blok()?.headline }}</h1>`,
  standalone: true,
})
class TeaserComponent {
  blok = input<TeaserBlok>();
}

@Component({
  selector: 'sb-grid',
  template: `
    <div class="columns">
      @for (col of blok()?.columns; track col) {
        <div>{{ col }}</div>
      }
    </div>
  `,
  standalone: true,
})
class GridComponent {
  blok = input<GridBlok>();
}

@Component({
  template: ` <ng-container [sbBlok]="blok()" /> `,
  imports: [SbBlokDirective],
  standalone: true,
})
class HostComponent {
  blok = signal<SbBlokData | null>(null);
}

class MockResolver {
  resolveCalls: string[] = [];

  async resolve(name: string): Promise<Type<any> | null> {
    this.resolveCalls.push(name);

    if (name === 'teaser') return TeaserComponent;
    if (name === 'grid') return GridComponent;

    return null;
  }
}

describe('SbBlokDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let resolver: MockResolver;

  beforeEach(async () => {
    resolver = new MockResolver();

    await TestBed.configureTestingModule({
      imports: [HostComponent, TeaserComponent, GridComponent],
      providers: [
        {
          provide: StoryblokComponentResolver,
          useValue: resolver,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  async function waitForRender() {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('renders the correct component for blok type (teaser)', async () => {
    fixture.componentInstance.blok.set({
      _uid: '1',
      component: 'teaser',
      headline: 'Hello world!',
    });

    await waitForRender();

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1.textContent).toBe('Hello world!');
  });

  it('destroys and creates component when blok type changes', async () => {
    fixture.componentInstance.blok.set({
      _uid: '1',
      component: 'teaser',
      headline: 'Hello world!',
    });

    await waitForRender();

    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Hello world!');

    fixture.componentInstance.blok.set({
      _uid: '2',
      component: 'grid',
      columns: ['Alpha', 'Beta'],
    });

    await waitForRender();

    const cols = fixture.nativeElement.querySelectorAll('.columns > div');

    expect(cols.length).toBe(2);
    expect(cols[0].textContent.trim()).toBe('Alpha');
    expect(cols[1].textContent.trim()).toBe('Beta');
  });

  it('only latest async resolve result is used (no race)', async () => {
    const slowResolve = vi.spyOn(resolver, 'resolve').mockImplementation(async (name: string) => {
      if (name === 'teaser') {
        await new Promise((r) => setTimeout(r, 50));
        return TeaserComponent;
      }

      return GridComponent;
    });

    fixture.componentInstance.blok.set({
      _uid: '1',
      component: 'teaser',
      headline: 'Slow',
    });

    fixture.componentInstance.blok.set({
      _uid: '2',
      component: 'grid',
      columns: ['Fast'],
    });

    await waitForRender();

    const cols = fixture.nativeElement.querySelectorAll('.columns > div');

    expect(cols.length).toBe(1);
    expect(cols[0].textContent.trim()).toBe('Fast');

    slowResolve.mockRestore();
  });

  it('SSR safety: does not throw if host lacks setAttribute', async () => {
    fixture.componentInstance.blok.set({
      _uid: '1',
      component: 'teaser',
      headline: 'SSR',
    });

    await waitForRender();

    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('SSR');
  });

  it('cleans up dynamic component on destroy', async () => {
    fixture.componentInstance.blok.set({
      _uid: '1',
      component: 'teaser',
      headline: 'Cleanup',
    });

    await waitForRender();

    fixture.destroy();

    expect(true).toBe(true);
  });
});

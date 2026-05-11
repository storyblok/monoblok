import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StoryblokComponent } from './sb-component.component';
import { STORYBLOK_COMPONENTS } from '../components.feature';
import { SbBlokData } from '../types';

type TestBlok = SbBlokData & {
  component: 'test';
  title: string;
};

@Component({
  selector: 'sb-test',
  template: `<div class="test-component">{{ blok()?.title }}</div>`,
  standalone: true,
})
class TestComponent {
  blok = input<TestBlok>();
}

describe('StoryblokComponent', () => {
  let fixture: ComponentFixture<StoryblokComponent>;

  const mockBlok: SbBlokData = {
    _uid: '1',
    component: 'test',
    title: 'Test Blok',
  };

  const setup = async (input: SbBlokData | SbBlokData[] | null | undefined) => {
    await TestBed.configureTestingModule({
      imports: [StoryblokComponent, TestComponent],
      providers: [{ provide: STORYBLOK_COMPONENTS, useValue: { test: TestComponent } }],
    }).compileComponents();

    fixture = TestBed.createComponent(StoryblokComponent);

    fixture.componentRef.setInput('sbBlok', input);

    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  };

  it('should render a single blok', async () => {
    await setup(mockBlok);

    const nodes = fixture.nativeElement.querySelectorAll('.test-component');

    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Test Blok');
  });

  it('should render multiple bloks', async () => {
    const bloks = [mockBlok, { ...mockBlok, _uid: '2', title: 'Second Blok' }];

    await setup(bloks);

    const nodes = fixture.nativeElement.querySelectorAll('.test-component');

    expect(nodes.length).toBe(2);
    expect(nodes[0].textContent).toBe('Test Blok');
    expect(nodes[1].textContent).toBe('Second Blok');
  });

  it('should render nothing for null', async () => {
    await setup(null);

    const nodes = fixture.nativeElement.querySelectorAll('.test-component');

    expect(nodes.length).toBe(0);
  });

  it('should render nothing for undefined', async () => {
    await setup(undefined);

    const nodes = fixture.nativeElement.querySelectorAll('.test-component');

    expect(nodes.length).toBe(0);
  });
});

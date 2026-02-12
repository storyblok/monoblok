import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoryblokAngular } from './storyblok-angular';

describe('StoryblokAngular', () => {
  let component: StoryblokAngular;
  let fixture: ComponentFixture<StoryblokAngular>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoryblokAngular]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoryblokAngular);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

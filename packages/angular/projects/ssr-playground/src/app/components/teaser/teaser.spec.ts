import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeaserComponent } from './teaser';

describe('TeaserComponent', () => {
  let component: TeaserComponent;
  let fixture: ComponentFixture<TeaserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeaserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeaserComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

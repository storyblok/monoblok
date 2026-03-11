import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeatureComponent } from './feature';

describe('FeatureComponent', () => {
  let component: FeatureComponent;
  let fixture: ComponentFixture<FeatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('blok', { _uid: 'test', component: 'feature' });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

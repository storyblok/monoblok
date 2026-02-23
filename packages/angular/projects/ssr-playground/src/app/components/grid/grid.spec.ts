import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Grid } from './grid';

describe('Grid', () => {
  let component: Grid;
  let fixture: ComponentFixture<Grid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Grid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Grid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

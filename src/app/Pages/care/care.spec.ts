import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Care } from './care';

describe('Care', () => {
  let component: Care;
  let fixture: ComponentFixture<Care>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Care],
    }).compileComponents();

    fixture = TestBed.createComponent(Care);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

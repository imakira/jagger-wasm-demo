import { TestBed } from '@angular/core/testing';

import { JaggerService } from './jagger.service';

describe('JaggerService', () => {
  let service: JaggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JaggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

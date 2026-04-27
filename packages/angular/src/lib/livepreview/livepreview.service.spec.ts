import { TestBed } from '@angular/core/testing';
import {
  LivePreviewService,
  LivePreviewNotEnabledError,
  LIVE_PREVIEW_ENABLED,
  LIVE_PREVIEW_CONFIG,
} from './livepreview.service';

describe('LivePreviewService', () => {
  describe('without live preview enabled', () => {
    let service: LivePreviewService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [LivePreviewService],
      });
      service = TestBed.inject(LivePreviewService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should throw LivePreviewNotEnabledError when listen() is called in dev mode', async () => {
      await expect(service.listen(() => {})).rejects.toThrow(LivePreviewNotEnabledError);
    });
  });

  describe('with live preview enabled', () => {
    let service: LivePreviewService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          LivePreviewService,
          { provide: LIVE_PREVIEW_ENABLED, useValue: true },
          { provide: LIVE_PREVIEW_CONFIG, useValue: {} },
        ],
      });
      service = TestBed.inject(LivePreviewService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });
});

describe('LivePreviewNotEnabledError', () => {
  it('should have correct error name', () => {
    const error = new LivePreviewNotEnabledError();
    expect(error.name).toBe('LivePreviewNotEnabledError');
  });

  it('should have helpful error message', () => {
    const error = new LivePreviewNotEnabledError();
    expect(error.message).toContain('withLivePreview()');
    expect(error.message).toContain('provideStoryblok');
  });
});

import { TestBed } from '@angular/core/testing';
import { StoryblokService } from './storyblok.service';

describe('StoryblokService', () => {
  let service: StoryblokService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StoryblokService],
    });
    service = TestBed.inject(StoryblokService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should throw error when getClient() is called before initialization', () => {
    expect(() => service.getClient()).toThrowError(
      'Storyblok API client not initialized. Did you forget to call provideStoryblok()?',
    );
  });

  it('should initialize client with ɵinit()', () => {
    service.ɵinit({ accessToken: 'test-token' });
    expect(() => service.getClient()).not.toThrow();
  });

  it('should return the same client on subsequent getClient() calls', () => {
    service.ɵinit({ accessToken: 'test-token' });
    const client1 = service.getClient();
    const client2 = service.getClient();
    expect(client1).toBe(client2);
  });

  it('should only initialize once even if ɵinit() is called multiple times', () => {
    service.ɵinit({ accessToken: 'first-token' });
    const client1 = service.getClient();

    service.ɵinit({ accessToken: 'second-token' });
    const client2 = service.getClient();

    expect(client1).toBe(client2);
  });
});

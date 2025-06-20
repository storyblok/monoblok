import { getCapiUrl, getMapiUrl } from './regions.js';

describe('utils', () => {
  it('should work', () => {
    expect(getCapiUrl()).toEqual('https://api.storyblok.com/v2/cdn');
    expect(getMapiUrl('us')).toEqual('https://api-us.storyblok.com/v1');
  })
})

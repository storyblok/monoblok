import { mapiClient } from './api';

// TODO: Test the api client
describe.todo('api', () => {
  describe('mapiClient', () => {
    it('should create a mapi client', () => {
      const client = mapiClient();
      expect(client).toBeDefined();
    });
  });
});

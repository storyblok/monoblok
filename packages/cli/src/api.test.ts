import { getMapiClient } from './api';

// TODO: Test the api client
describe.todo('api', () => {
  describe('getMapiClient', () => {
    it('should create a mapi client', () => {
      const client = getMapiClient();
      expect(client).toBeDefined();
    });
  });
});

import { getAccessToken, getRefreshToken, saveTokens } from '../../utils/auth';
import { apiFetch } from '../../utils/api';

jest.mock('../../utils/auth', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
  removeTokens: jest.fn(),
}));

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('apiFetch', () => {
    it('should make successful API request with authorization header', async () => {
      getAccessToken.mockResolvedValue('mock-access-token');

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: 'test' }),
      });

      const result = await apiFetch('/test-endpoint', { method: 'GET' });

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );
    });

    it('should refresh token on 401 response', async () => {
      getAccessToken.mockResolvedValue('expired-token');
      getRefreshToken.mockResolvedValue('refresh-token');
      saveTokens.mockResolvedValue(undefined);

      // First call returns 401, second returns 200
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'new-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

      const result = await apiFetch('/test-endpoint');

      expect(result.ok).toBe(true);
      expect(saveTokens).toHaveBeenCalledWith('new-access-token', 'refresh-token');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error if refresh token is missing', async () => {
      getAccessToken.mockResolvedValue('expired-token');
      getRefreshToken.mockResolvedValue(null);

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(apiFetch('/test-endpoint')).rejects.toThrow('Not authenticated');
    });

    it('should logout if token refresh fails', async () => {
      getAccessToken.mockResolvedValue('expired-token');
      getRefreshToken.mockResolvedValue('invalid-refresh-token');

      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({}),
        });

      await expect(apiFetch('/test-endpoint')).rejects.toThrow(
        'Session expired. Please login again.'
      );
    });

    it('should handle FormData requests without Content-Type override', async () => {
      getAccessToken.mockResolvedValue('mock-access-token');

      const formData = new FormData();
      formData.append('file', { uri: 'test.txt', type: 'text/plain' });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await apiFetch('/upload', { method: 'POST', body: formData });

      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBeUndefined();
    });

    it('should add Content-Type header for JSON requests', async () => {
      getAccessToken.mockResolvedValue('mock-access-token');

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await apiFetch('/test', { method: 'POST', body: JSON.stringify({}) });

      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });
  });
});

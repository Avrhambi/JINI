import * as SecureStore from 'expo-secure-store';
import {
    getAccessToken,
    getRefreshToken,
    removeUserCredentials,
    saveUserCredentials,
    getUserInfo,
    saveGoogleLogin,
    getGoogleLoginStatus,
    saveTokens,
} from '../../utils/auth';

describe('Auth Utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SecureStore.setItemAsync.mockResolvedValue(undefined);
        SecureStore.getItemAsync.mockResolvedValue(null);
        SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    });

    describe('getAccessToken', () => {
        it('should retrieve access token from secure store', async () => {
            const mockToken = 'test-access-token';
            SecureStore.getItemAsync.mockResolvedValue(mockToken);

            const result = await getAccessToken();

            expect(result).toBe(mockToken);
            expect(SecureStore.getItemAsync).toHaveBeenCalledWith('accessToken');
        });

        it('should return null if no token exists', async () => {
            SecureStore.getItemAsync.mockResolvedValue(null);

            const result = await getAccessToken();

            expect(result).toBeNull();
        });
    });

    describe('getRefreshToken', () => {
        it('should retrieve refresh token from secure store', async () => {
            const mockToken = 'test-refresh-token';
            SecureStore.getItemAsync.mockResolvedValue(mockToken);

            const result = await getRefreshToken();

            expect(result).toBe(mockToken);
            expect(SecureStore.getItemAsync).toHaveBeenCalledWith('refreshToken');
        });
    });

    describe('removeUserCredentials', () => {
        it('should remove all user credentials from secure store', async () => {
            await removeUserCredentials();

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userInfo');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
        });
    });

    describe('saveUserCredentials', () => {
        it('should save user credentials and info to secure store', async () => {
            const accessToken = 'access-123';
            const refreshToken = 'refresh-123';
            const userInfo = { name: 'John Doe', email: 'john@example.com', id: '123' };

            await saveUserCredentials(accessToken, refreshToken, userInfo);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', accessToken);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', refreshToken);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'userInfo',
                JSON.stringify(userInfo)
            );
        });

        it('should throw error if save fails', async () => {
            const error = new Error('Storage failed');
            SecureStore.setItemAsync.mockRejectedValue(error);

            await expect(
                saveUserCredentials('token', 'refresh', {})
            ).rejects.toThrow('Failed to save user credentials');
        });
    });

    describe('getUserInfo', () => {
        it('should retrieve and parse user info from secure store', async () => {
            const userInfo = { name: 'Jane Doe', email: 'jane@example.com', id: '456' };
            SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(userInfo));

            const result = await getUserInfo();

            expect(result).toEqual(userInfo);
            expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userInfo');
        });

        it('should return null if no user info exists', async () => {
            SecureStore.getItemAsync.mockResolvedValue(null);

            const result = await getUserInfo();

            expect(result).toBeNull();
        });
    });

    describe('saveGoogleLogin', () => {
        it('should save google login status as true', async () => {
            await saveGoogleLogin(true);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('isGoogleLogin', 'true');
        });

        it('should save google login status as false', async () => {
            await saveGoogleLogin(false);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('isGoogleLogin', 'false');
        });
    });

    describe('getGoogleLoginStatus', () => {
        it('should return true if google login was used', async () => {
            SecureStore.getItemAsync.mockResolvedValue('true');

            const result = await getGoogleLoginStatus();

            expect(result).toBe(true);
        });

        it('should return false if google login was not used', async () => {
            SecureStore.getItemAsync.mockResolvedValue('false');

            const result = await getGoogleLoginStatus();

            expect(result).toBe(false);
        });

        it('should return false if status not set', async () => {
            SecureStore.getItemAsync.mockResolvedValue(null);

            const result = await getGoogleLoginStatus();

            expect(result).toBe(false);
        });
    });

    describe('saveTokens', () => {
        it('should save access and refresh tokens', async () => {
            const accessToken = 'new-access-123';
            const refreshToken = 'new-refresh-123';

            await saveTokens(accessToken, refreshToken);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', accessToken);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', refreshToken);
        });

        it('should throw error if token save fails', async () => {
            const error = new Error('Token save failed');
            SecureStore.setItemAsync.mockRejectedValue(error);

            await expect(
                saveTokens('token', 'refresh')
            ).rejects.toThrow('Failed to save tokens');
        });
    });
});

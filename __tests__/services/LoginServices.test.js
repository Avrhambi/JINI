import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
    performGoogleLogin,
    validateLoginForm,
    performLogin,
} from '../../services/LoginServices';

describe('Login Services', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockClear();
    });

    describe('validateLoginForm', () => {
        it('should return error if email is missing', () => {
            const error = validateLoginForm('', 'password123');
            expect(error).toBe('All fields are required.');
        });

        it('should return error if password is missing', () => {
            const error = validateLoginForm('test@example.com', '');
            expect(error).toBe('All fields are required.');
        });

        it('should return error if both email and password are missing', () => {
            const error = validateLoginForm('', '');
            expect(error).toBe('All fields are required.');
        });

        it('should return null if both email and password are provided', () => {
            const error = validateLoginForm('test@example.com', 'password123');
            expect(error).toBeNull();
        });
    });

    describe('performGoogleLogin', () => {
        it('should successfully login with Google and return user data', async () => {
            GoogleSignin.hasPlayServices.mockResolvedValue(true);
            GoogleSignin.signOut.mockResolvedValue();
            GoogleSignin.signIn.mockResolvedValue({
                data: {
                    idToken: 'mock-id-token',
                    user: {
                        name: 'John Doe',
                        email: 'john@example.com',
                    },
                },
            });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    name: 'John Doe',
                    email: 'john@example.com',
                    user_id: '12345',
                }),
            });

            const result = await performGoogleLogin();

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('userInfo');
            expect(result.userInfo.name).toBe('John Doe');
            expect(result.userInfo.email).toBe('john@example.com');
            expect(GoogleSignin.signIn).toHaveBeenCalled();
        });

        it('should throw error if no ID token is received', async () => {
            GoogleSignin.hasPlayServices.mockResolvedValue(true);
            GoogleSignin.signOut.mockResolvedValue();
            GoogleSignin.signIn.mockResolvedValue({
                data: {
                    idToken: null,
                    user: {
                        name: 'John Doe',
                        email: 'john@example.com',
                    },
                },
            });

            await expect(performGoogleLogin()).rejects.toThrow('No ID Token received from Google');
        });

        it('should throw error if server returns error', async () => {
            GoogleSignin.hasPlayServices.mockResolvedValue(true);
            GoogleSignin.signOut.mockResolvedValue();
            GoogleSignin.signIn.mockResolvedValue({
                data: {
                    idToken: 'mock-id-token',
                    user: {
                        name: 'John Doe',
                        email: 'john@example.com',
                    },
                },
            });

            global.fetch.mockResolvedValue({
                ok: false,
                json: async () => ({
                    detail: 'Invalid credentials',
                }),
            });

            await expect(performGoogleLogin()).rejects.toThrow('Invalid credentials');
        });

        it('should throw error if Google Play Services are not available', async () => {
            GoogleSignin.hasPlayServices.mockRejectedValue(new Error('Play Services not available'));

            await expect(performGoogleLogin()).rejects.toThrow();
        });

        it('should sign out before signing in', async () => {
            GoogleSignin.hasPlayServices.mockResolvedValue(true);
            GoogleSignin.signOut.mockResolvedValue();
            GoogleSignin.signIn.mockResolvedValue({
                data: {
                    idToken: 'mock-id-token',
                    user: {
                        name: 'John Doe',
                        email: 'john@example.com',
                    },
                },
            });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    name: 'John Doe',
                    email: 'john@example.com',
                    user_id: '12345',
                }),
            });

            await performGoogleLogin();

            expect(GoogleSignin.signOut).toHaveBeenCalled();
            expect(GoogleSignin.signIn).toHaveBeenCalled();
        });
    });

    describe('performLogin', () => {
        it('should successfully login with email and password', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    user: {
                        name: 'Jane Doe',
                        email: 'jane@example.com',
                    },
                }),
            });

            const result = await performLogin('jane@example.com', 'password123');

            expect(result.success).toBe(true);
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBe('mock-refresh-token');
        });

        it('should return error if login fails', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                json: async () => ({
                    detail: 'Invalid email or password',
                }),
            });

            const result = await performLogin('jane@example.com', 'wrongpassword');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid email or password');
        });

        it('should return error if server does not respond', async () => {
            global.fetch.mockResolvedValue(null);

            const result = await performLogin('jane@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('No response from server');
        });

        it('should handle generic login error', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                json: async () => ({}),
            });

            const result = await performLogin('jane@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Login failed.');
        });

        it('should extract name from user object', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    user: {
                        name: 'Custom Name',
                        email: 'test@example.com',
                    },
                }),
            });

            const result = await performLogin('test@example.com', 'password123');

            expect(result.success).toBe(true);
        });

        it('should timeout if request takes too long', async () => {
            jest.useFakeTimers();
            global.fetch.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 15000))
            );

            const loginPromise = performLogin('test@example.com', 'password123');
            jest.advanceTimersByTime(11000);

            const result = await loginPromise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Request timed out');
            jest.useRealTimers();
        }, 20000);
    });
});

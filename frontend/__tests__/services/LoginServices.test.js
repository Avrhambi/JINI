import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
    performGoogleLogin,
    validateLoginForm,
    performLogin,
} from '../../services/LoginServices';

const BASE_URL = process.env.BASE_URL || process.env.EXPO_PUBLIC_BASE_URL;
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'asi@bla.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'a';
const MOCK_FETCH = global.fetch;
const REAL_FETCH = global.realFetch;

describe('Login Services', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        if (global.fetch?.mockClear) {
            global.fetch.mockClear();
        }
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
        beforeAll(() => {
            expect(typeof REAL_FETCH).toBe('function');
            global.fetch = REAL_FETCH;
        });

        afterAll(() => {
            global.fetch = MOCK_FETCH;
        });

        it('should successfully login with real backend credentials', async () => {
            expect(BASE_URL).toBeTruthy();

            const result = await performLogin(TEST_EMAIL, TEST_PASSWORD);

            expect(result.success).toBe(true);
            expect(result.accessToken).toBeTruthy();
            expect(result.refreshToken).toBeTruthy();
            expect(result.userInfo).toBeDefined();
        }, 20000);

        it('should return error for invalid password from real backend', async () => {
            expect(BASE_URL).toBeTruthy();

            const result = await performLogin(TEST_EMAIL, 'invalid-password-for-test');

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        }, 20000);
    });
});

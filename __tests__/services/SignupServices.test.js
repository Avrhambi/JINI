import {
  validateSignupForm,
  performSignup,
} from '../../services/SignupServices';

const BASE_URL = process.env.BASE_URL || process.env.EXPO_PUBLIC_BASE_URL;
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'asi@bla.com';
const MOCK_FETCH = global.fetch;
const REAL_FETCH = global.realFetch;

describe('Signup Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (global.fetch?.mockClear) {
      global.fetch.mockClear();
    }
  });

  describe('validateSignupForm', () => {
    it('should return error if any field is missing', () => {
      const fields = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'Password123!',
        ConfirmPassword: 'Password123!',
        FirstName: 'John',
        LastName: '',
      };

      const error = validateSignupForm(fields);
      expect(error).toBe('All fields are required.');
    });

    it('should return error if email is invalid', () => {
      const fields = {
        UserName: 'john_doe',
        Email: 'invalid-email',
        Password: 'Password123!',
        ConfirmPassword: 'Password123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      const error = validateSignupForm(fields);
      expect(error).toBe('Please enter a valid email address.');
    });

    it('should return error if password does not meet requirements', () => {
      const fields = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'weak',
        ConfirmPassword: 'weak',
        FirstName: 'John',
        LastName: 'Doe',
      };

      const error = validateSignupForm(fields);
      expect(error).toBe('Password does not match requirements.');
    });

    it('should return error if passwords do not match', () => {
      const fields = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'Password123!',
        ConfirmPassword: 'Password456!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      const error = validateSignupForm(fields);
      expect(error).toBe('Passwords do not match.');
    });

    it('should return null for valid form', () => {
      const fields = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      const error = validateSignupForm(fields);
      expect(error).toBeNull();
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@domain.com',
        'user.name@example.co.uk',
        'a+b@test.org',
      ];

      for (const email of validEmails) {
        const fields = {
          UserName: 'john_doe',
          Email: email,
          Password: 'ValidPassword123!',
          ConfirmPassword: 'ValidPassword123!',
          FirstName: 'John',
          LastName: 'Doe',
        };

        const error = validateSignupForm(fields);
        expect(error).toBeNull();
      }
    });

    it('should validate password requirements (uppercase, lowercase, digit, special char)', () => {
      const invalidPasswords = [
        'password123!',      // no uppercase
        'PASSWORD123!',      // no lowercase
        'Password!',         // no digit
        'Password123',       // no special char
        'Pas123!',          // too short (< 8 chars)
      ];

      for (const password of invalidPasswords) {
        const fields = {
          UserName: 'john_doe',
          Email: 'john@example.com',
          Password: password,
          ConfirmPassword: password,
          FirstName: 'John',
          LastName: 'Doe',
        };

        const error = validateSignupForm(fields);
        if (error === null) {
            console.warn(`!!! Password [${password}] bypasses validation and returns NULL`);
        }
        expect(error).toBe('Password does not match requirements.');
      }
    });
  });

  describe('performSignup', () => {
    beforeAll(() => {
      expect(typeof REAL_FETCH).toBe('function');
      global.fetch = REAL_FETCH;
    });

    afterAll(() => {
      global.fetch = MOCK_FETCH;
    });

    it('should return error if email already exists (real backend)', async () => {
      expect(BASE_URL).toBeTruthy();

      const userData = {
        UserName: 'existing_user_test',
        Email: TEST_EMAIL,
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      const result = await performSignup(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email');
    }, 20000);

    it('should create a new user on real backend with unique email', async () => {
      expect(BASE_URL).toBeTruthy();

      const uniqueSuffix = Date.now();
      const userData = {
        UserName: `live_user_${uniqueSuffix}`,
        Email: `live_user_${uniqueSuffix}@example.com`,
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'Live',
        LastName: 'Tester',
      };

      const result = await performSignup(userData);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.Email);
    }, 20000);
  });
});

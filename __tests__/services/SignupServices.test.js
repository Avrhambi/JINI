import {
  validateSignupForm,
  performSignup,
} from '../../services/SignupServices';

describe('Signup Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
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
    it('should successfully sign up a new user', async () => {
      const userData = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user_id: '12345',
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
      });

      const result = await performSignup(userData);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.id).toBe('12345');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user.name).toBe('John Doe');
    });

    it('should return error if email already exists', async () => {
      const userData = {
        UserName: 'john_doe',
        Email: 'existing@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          detail: 'email already registered',
        }),
      });

      const result = await performSignup(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email is already in use.');
    });

    it('should return error on server failure', async () => {
      const userData = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          detail: 'Server error',
        }),
      });

      const result = await performSignup(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('should return error on network timeout', async () => {
      const userData = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      global.fetch.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await performSignup(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server took too long to respond');
    }, 15000);

    it('should handle generic network errors', async () => {
      const userData = {
        UserName: 'john_doe',
        Email: 'john@example.com',
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'John',
        LastName: 'Doe',
      };

      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await performSignup(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});

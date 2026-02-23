import { saveUserCredentials } from '../utils/auth';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

/**
 * Validates the signup form fields
 * @returns {string|null} Error message if invalid, null if valid
 */
export const validateSignupForm = (fields) => {
  const { UserName, Email, Password, ConfirmPassword, FirstName, LastName } = fields;  
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(Email)) {
    return 'Please enter a valid email address.';
  }

  const hasUpper = /[A-Z]/.test(Password);
  const hasLower = /[a-z]/.test(Password);
  const hasNumber = /\d/.test(Password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_]/.test(Password);
  const hasLength = Password.length >= 8;

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial || !hasLength) {
    return 'Password does not match requirements.';
  }
  if (Password !== ConfirmPassword) {
    return 'Passwords do not match.';
  }

  if (!UserName || !Email || !Password || !ConfirmPassword || !FirstName || !LastName) {
    return 'All fields are required.';
  }
  return null;
};

/**
 * Handles the API call to register a new user
 * @param {Object} userData - User details from form
 * @returns {Promise<Object>} Object containing success status and data/error
 */
export const performSignup = async (userData) => {
  const { UserName, Email, Password, FirstName, LastName } = userData;

  const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  try {
    const response = await Promise.race([
      fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: UserName,
          first_name: FirstName,
          last_name: LastName,
          email: Email,
          password: Password
        })
      }),
      timeout(8000)
    ]);

    const data = await response.json();

    if (!response.ok) {
      let errorMessage = data.detail || "Signup failed. Please try again.";
      if (data.detail && data.detail.includes("email")) {
        errorMessage = "Email is already in use.";
      }
      return { success: false, error: errorMessage };
    }

    // Prepare info for local storage
    const userInfo = {
      id: data["user_id"],
      email: Email,
      name: `${FirstName} ${LastName}`
    };

    return { 
      success: true, 
      accessToken: data["access_token"], // Match your backend key names
      refreshToken: data["refresh_token"],
      user: userInfo 
    };

  } catch (error) {
    let msg = `Network error. Please try again. ${error.message}`;
    if (error.message === "Request timed out") {
      msg = "Server took too long to respond. Please try again.";
    }
    return { success: false, error: msg };
  }
};
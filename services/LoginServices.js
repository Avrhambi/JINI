import { GoogleSignin } from '@react-native-google-signin/google-signin';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

/**
 * Executes the Google Sign-In flow and authenticates with the backend
 * @returns {Object} { success: boolean, error?: string, cancelled?: boolean }
 */
export const performGoogleLogin = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    await GoogleSignin.signOut(); 
    const result = await GoogleSignin.signIn();
    const idToken = result.data?.idToken;
    
    if (!idToken) {
      throw new Error("No ID Token received from Google");
    }

    const response = await fetch(`${BASE_URL}/auth/login/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken })
    });

    const data = await response.json();
    console.log("Google Login Response:", data);

    if (response.ok) {
      return {
        accessToken: data["access_token"],
        refreshToken: data["refresh_token"],
        userInfo: {
          name: data["name"] || result.data.user.name,
          email: data["email"] || result.data.user.email,
          id: data["user_id"]
        }
      };
    } else {
      throw new Error(data.detail || 'Login failed on server');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Validates the login form fields
 * @param {string} email 
 * @param {string} password 
 * @returns {string|null} Error message or null
 */
export const validateLoginForm = (email, password) => {
  if (!email || !password) {
    return 'All fields are required.';
  }
  return null;
};

/**
 * Handles the standard email/password login API call
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} Success status and data/error
 */
export const performLogin = async (email, password) => {
  const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  try {
    const response = await Promise.race([
      fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }),
      timeout(10000) // Increased to 10s just to be safe for APKs
    ]);

    // Check if the response exists and is valid
    if (!response) {
       throw new Error("No response from server");
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.detail || "Login failed." };
    }
    
    const user = data.user || data; 
    const name = user["name"] 
      ? user["name"]
      : 'User';

    return {
      success: true,
      accessToken: data["access_token"],
      refreshToken: data["refresh_token"],
      userInfo: {
        name: name,
        email: email,
        id: data["user_id"]
      }
    };
  } catch (error) {
    let msg;
    if (error.message === "Request timed out") {
      msg = "Request timed out"; 
    } else if (error.message === "No response from server") {
      msg = "No response from server"; 
    } else {
      msg = "Failed to process login data.";
    }
    
    return { success: false, error: msg };
  }
};
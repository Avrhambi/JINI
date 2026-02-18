import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Get access token
export const getAccessToken = async () => {
  return await SecureStore.getItemAsync("accessToken");
};

// Get refresh token
export const getRefreshToken = async () => {
  return await SecureStore.getItemAsync("refreshToken");
};

// Remove tokens (logout)
export const removeUserCredentials = async () => {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
  await SecureStore.deleteItemAsync('userInfo');
};

// Save user credentials
export const saveUserCredentials = async (accessToken, refreshToken, userInfo) => {
  try {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    await SecureStore.setItemAsync("userInfo", JSON.stringify(userInfo));
  } catch (error) {
    throw new Error("Failed to save user credentials: " + error.message);
  }
};

// Get user info
export const getUserInfo = async () => {
  const info = await SecureStore.getItemAsync("userInfo");
  return info ? JSON.parse(info) : null;
};

// save if user is logged in with google
export const saveGoogleLogin = async (isGoogleLogin) => {
  await SecureStore.setItemAsync("isGoogleLogin", isGoogleLogin ? "true" : "false");
};

// Get google login status
export const getGoogleLoginStatus = async () => {
  return await SecureStore.getItemAsync("isGoogleLogin") === "true";
};

// Save tokens
export const saveTokens = async (accessToken, refreshToken) => {
  try {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
  } catch (error) {
    throw new Error("Failed to save tokens: " + error.message);
  }              
};
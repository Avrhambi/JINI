import * as SecureStore from 'expo-secure-store';

// Save access and refresh tokens
export const saveUserCredentials = async (accessToken, refreshToken) => {
  await SecureStore.setItemAsync("accessToken", accessToken);
  await SecureStore.setItemAsync("refreshToken", refreshToken);
  await SecureStore.setItemAsync("userInfo", JSON.stringify(userInfo));
};

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

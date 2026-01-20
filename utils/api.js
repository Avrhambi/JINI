import { getAccessToken, getRefreshToken, saveTokens, removeTokens } from './auth';

// const BASE_URL = 'http://192.168.1.144:8000'; // your backend

// Generic fetch wrapper
export const apiFetch = async (endpoint, options = {}) => {
  let accessToken = await getAccessToken();
  console.log (accessToken)
  console.log(endpoint)
  console.log("before token",options)

  // Add Authorization header
  options.headers = {
    ...(options.headers || {}),
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`
  };

  console.log("after token", options)
  let response = await fetch(`${BASE_URL}${endpoint}`, options);

  // If token expired, try refresh
  if (response.status === 401) {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error('Not authenticated');
    }

    // Request new access token
    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!refreshResponse.ok) {
      await removeTokens(); // logout if refresh fails
      throw new Error('Session expired. Please login again.');
    }

    const refreshData = await refreshResponse.json();
    accessToken = refreshData['access_token'];
    await saveTokens(accessToken, refreshToken);

    // Retry original request with new access token
    options.headers.Authorization = `Bearer ${accessToken}`;
    response = await fetch(`${BASE_URL}${endpoint}`, options);
  }

  const data = await response.json();
  return { ok: response.ok, data };
};

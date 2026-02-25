import { getAccessToken, getRefreshToken, saveTokens, removeTokens } from './auth';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const isFormDataLike = (body) => {
  if (!body || typeof body !== 'object') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (Array.isArray(body?._parts)) return true;
  return typeof body.append === 'function' && typeof body.getParts === 'function';
};

// Generic fetch wrapper
export const apiFetch = async (endpoint, options = {}) => {
  let accessToken = await getAccessToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`
  };

  if (!isFormDataLike(options.body)) {
    headers['Content-Type'] = 'application/json';
  }
  options.headers = headers;
  let response = await fetch(`${BASE_URL}${endpoint}`, options);


  // If token expired, try refresh
  if (response.status === 401) {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      throw new Error('Not authenticated');
    }
    const formdata = new FormData();
    formdata.append('refresh_token', refreshToken);
    // Request new access token
    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'PUT',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formdata,
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

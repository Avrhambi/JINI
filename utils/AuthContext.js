import React, { createContext, useState, useEffect } from 'react';
import { 
  getAccessToken, 
  saveUserCredentials, 
  removeUserCredentials, 
  getGoogleLoginStatus, 
  saveGoogleLogin
} from './auth.js'; 

import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token;
      try {
        token = await getAccessToken();
      } catch (e) {
        throw new Error("Failed to load user token");
      }
      setUserToken(token);
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  const authContext = {
    userToken,
    isLoading,
    signIn: async (accessToken, refreshToken, userInfo) => {
      if (!accessToken || !refreshToken) {
        throw new Error("Signup/Login failed: Tokens are missing from server response");
      }
      // 1. Save to Secure Storage using your utility
      await saveUserCredentials(accessToken, refreshToken, userInfo);
      // 2. Update the state so the UI swaps screens
      setUserToken(accessToken);
    },
    signOut: async () => {
      try {
          // 1. Check if it was a Google login
          const isGoogle = await getGoogleLoginStatus();
          if (isGoogle) {
            await GoogleSignin.signOut();
          }
          
          // 2. Clear SecureStore (accessToken, refreshToken, userInfo)
          await removeUserCredentials();
          
          // 3. Clear Google status
          await saveGoogleLogin(false);
          
          // 4. Update state to trigger UI swap
          setUserToken(null);
        } catch (error) {
          throw new Error("Sign out failed: " + error.message);
        }
    },
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
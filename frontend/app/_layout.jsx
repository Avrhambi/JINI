import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const RootLayout = () => {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        const userInfo = await SecureStore.getItemAsync('userInfo');

        if (token && userInfo) {
          // User is logged in, go to feed
          router.replace('/feed');
        } else {
          // User not logged in, go to login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkLogin();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack />;
};

export default RootLayout;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

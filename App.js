import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import Main from './Navigation/Main';
import Login from './Navigation/screens/Login';
import Signup from './Navigation/screens/Signup';
import Home from './Navigation/screens/Home';
import Listen from './Navigation/screens/Listen';
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// At the top level, before your component exports
GoogleSignin.configure({
  webClientId: '554785841727-g9of1jn1v5g54ph58gnfht2uj6vfn46m.apps.googleusercontent.com',
  offlineAccess: true,
});

const Stack = createNativeStackNavigator();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    "Bitter-Regular": require("./assets/fonts/Bitter-Regular.ttf"),
  });

const [initialRoute, setInitialRoute] = React.useState(null);

useEffect(() => {
    async function prepareApp() {
      try {
        // Check if token exists
        const token = await AsyncStorage.getItem('user_token');
        if (token) {
          setInitialRoute("Home");
        } else {
          setInitialRoute("Main");
        }
      } catch (e) {
        setInitialRoute("Main");
      } finally {
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      }
    }
    prepareApp();
  }, [fontsLoaded]);

  if (!fontsLoaded || !initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator 
        // If logged in, start at Home. If not, start at Main.
        initialRouteName={initialRoute} 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Main" component={Main} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Signup" component={Signup} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Listen" component={Listen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}




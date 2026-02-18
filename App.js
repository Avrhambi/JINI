import React, { useEffect, useContext } from 'react';
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { I18nManager } from 'react-native';

// Importing Screens
import Main from './Navigation/Main';
import Login from './Navigation/screens/Login';
import Signup from './Navigation/screens/Signup';
import Home from './Navigation/screens/Home';
import Listen from './Navigation/screens/Listen';

// Import Utils
import { AuthContext, AuthProvider } from './utils/AuthContext';

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

GoogleSignin.configure({
  webClientId: '56386705598-coagpg2nsd2ql4gqhq47c6vgn2sc9uu9.apps.googleusercontent.com',
  offlineAccess: true,
});

const Stack = createNativeStackNavigator();

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { userToken, isLoading } = useContext(AuthContext);
  const [fontsLoaded] = useFonts({
    "Bitter-Regular": require("./assets/fonts/Bitter-Regular.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null;
  }


  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} >
        {userToken == null ? (
          <>
            <Stack.Screen name="Main" component={Main} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={Signup} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="Listen" component={Listen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}





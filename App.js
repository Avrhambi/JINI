import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import Main from './Navigation/Main';
import Login from './Navigation/screens/Login';
import Signup from './Navigation/screens/Signup';
import Home from './Navigation/screens/Home';
import Listen from './Navigation/screens/Listen';
import { useFonts } from "expo-font";
import AppLoading from "expo-app-loading";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();
export default function App() {
  const [fontsLoaded] = useFonts({
    "Bitter-Regular": require("./assets/fonts/Bitter-Regular.ttf"),
  });

  if (!fontsLoaded) {
    return <AppLoading />; // wait until fonts are ready
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={Main} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Signup" component={Signup} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Listen" component={Listen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}



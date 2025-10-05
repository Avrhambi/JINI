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

  useEffect(() => {
    if (fontsLoaded) {
      // Hide the splash screen after the fonts have loaded
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Don't render the app until fonts are loaded
  if (!fontsLoaded) {
    return null;
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


// import React from 'react';
// import { StatusBar } from 'expo-status-bar';
// import { StyleSheet, Text, View } from 'react-native';
// import Main from './Navigation/Main';
// import Login from './Navigation/screens/Login';
// import Signup from './Navigation/screens/Signup';
// import Home from './Navigation/screens/Home';
// import Listen from './Navigation/screens/Listen';
// import { useFonts } from "expo-font";
// import AppLoading from "~";
// import { NavigationContainer } from '@react-navigation/native';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

// const Stack = createNativeStackNavigator();
// export default function App() {
//   const [fontsLoaded] = useFonts({
//     "Bitter-Regular": require("./assets/fonts/Bitter-Regular.ttf"),
//   });

//   if (!fontsLoaded) {
//     return <AppLoading />; // wait until fonts are ready
//   }

//   return (
//     <NavigationContainer>
//       <Stack.Navigator screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="Main" component={Main} />
//         <Stack.Screen name="Login" component={Login} />
//         <Stack.Screen name="Signup" component={Signup} />
//         <Stack.Screen name="Home" component={Home} />
//         <Stack.Screen name="Listen" component={Listen} />
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }



import React, {useEffect} from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {  saveUserCredentials } from '../../utils/auth';
import * as Progress from 'react-native-progress';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
// import * as Google from 'expo-auth-session/providers/google';





export default function LoginScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const navigation = useNavigation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const allFieldsFilled = email && password;
  const handleGoogleSignIn = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    
    console.log('User Info:', userInfo);
    // userInfo.idToken - send this to your backend
    
    navigation.navigate('Home');
  } catch (error) {
    console.error('Google Sign-In Error:', error);
  }
};
//   const [request, response, promptAsync] = Google.useAuthRequest({
//   androidClientId: '554785841727-gco8l0obkhk5drk064l6dal7j7aqrkv0.apps.googleusercontent.com',
// });

  // const handleGoogleSignIn = async () => {
  //   try {
  //     // Prompt user to sign in
  //     const result = await promptAsync();

  //     if (result.type === 'success') {
  //       const accessToken = result.authentication.accessToken;
  //       console.log('Google access token:', accessToken);

  //       // Fetch user info
  //       const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
  //         headers: { Authorization: `Bearer ${accessToken}` },
  //       });
  //       const user = await res.json();
  //       console.log('Google user info:', user);

  //       // You can now save user info or send token to backend
  //       // Example: saveUserCredentials(accessToken, null);

  //       // Navigate to Home
  //       navigation.navigate('Home');
  //     }
  //   } catch (err) {
  //     console.error('Google Sign-In error:', err);
  //   }
  // };



  const handle_login = async () => {
    // const BASE_URL = 'http://192.168.1.144:8000'
    // const BASE_URL = `http://192.168.1.93:8000`
    const BASE_URL = 'http://10.0.2.2:8000'
    setError('');
    if (!allFieldsFilled) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );
    Promise.race([
      fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password})
      }),
      timeout(8000)
    ])

    .then(async (response) => {
    if (!response || !response.ok) {
      const data = response ? await response.json() : {};
      setLoading(false);
      setError(data.detail || "Login failed. Please try again.");
      return;
    }
    try {
      const data = await response.json();
      saveUserCredentials(data["access_token"],data["refresh_token"])
      setLoading(false);
      navigation.navigate('Home')
    } catch (error) {
      setError('Login error:', err);
    }
    ;
  })
  .catch((error) => {
    setLoading(false);
    if (error.message === "Request timed out") {
      setError("Server took too long to respond. Please try again.");
    } else {
      console.log(error.message)
      setError(`Network error. Please try again. ${error.message}`);

    }
  });
  };
  return (
  <LinearGradient
    colors={["#E1E6E7", "#ADC3C7", "#424242"]}
    locations={[0.25, 0.63, 1]}   // match your figma stops
    style={styles.container}
  >
    <View style={styles.topSection}>
      <View style = {styles.logo}>
        <Text style={styles.jini}>JINI</Text>
        <Image
        source={require("../../assets/genie-512.png")} // path to your PNG
        style={styles.icon}
        resizeMode="center" // ensures it scales properly
        />
      </View>
    </View>

    <View style={styles.middleSection}>
      <View style={styles.fieldsBox}>
        <TextInput style={styles.fields} placeholder="Email" placeholderTextColor="#ffffff" value={email} onChangeText={setEmail} />
      </View>
      <View style={styles.fieldsBox}>
        <TextInput style={styles.fields} placeholder="Password" placeholderTextColor="#ffffff" value={password} onChangeText={setPassword} />
      </View>
      <View style={styles.LoginBox}>
        <TouchableOpacity onPress={handle_login} disabled={loading} style={styles.loginButton}>
          {loading ? (
            <Progress.Circle 
              size={32} 
              indeterminate={true} 
              color="#007AFF" 
              thickness={3}
              style={styles.spinner}
            />
          ) : (
            <Text style={styles.title}>LOGIN</Text>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.googleButton}> 
        <TouchableOpacity style={styles.googleContent} onPress={handleGoogleSignIn}>
          <Image
            source={require("../../assets/search.png")} // path to your PNG
            style={styles.googleIcon}
            resizeMode="contain" // ensures it scales properly
          />
          <Text style={styles.infoGoogle}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.bottomSection}>
      <View style={styles.SignupContent}>
          <Text style={styles.info}>Don’t have an account?</Text>
          <TouchableOpacity  onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signup}>SIGN UP</Text>
          </TouchableOpacity>
      </View>
      
    </View>
  </LinearGradient>
  );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent"
  },
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
  },
  jini: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginTop: 10,
  },
  topSection: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
  },
  button: {
    backgroundColor: "#2D5C5C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
  },
  icon: {
    width: 39,
    height: 39,
    marginBottom: 10,
  },
  middleSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 100,
  },
  fields: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",

  },fieldsBox: {
    backgroundColor: "#2D5C5C",
    borderRadius: 10,
    width: "80%",
    paddingVertical: 10,
    marginBottom: 20,
    paddingHorizontal: 10,
    
  },
  info: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
    textAlign: 'center',
  },
  logo: {
    alignItems: 'center',
  },
  signupBox: {
    marginTop: '10%',
    marginBottom: 30,
    display: 'flex',
    flexDirection: 'column',
  },
  signup: {
    fontFamily: "Bitter-Regular",
    paddingVertical: 10,
    borderRadius: 10,
    color: "#fff",
    fontSize: 20,
    alignItems: 'center',
    marginLeft: 10,
  },
    SignupContent: {
    flexDirection: "row",   
    alignItems: "center",   
    justifyContent: "center",
  },
  error: {
    position: 'absolute',
    top: 50,
    color: "red",
    textAlign: "center",
    fontSize: 16,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    width: "70%",
    marginTop: 40,
  },
   infoGoogle: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#000",
  },
    googleContent: {
    flexDirection: "row",   
    alignItems: "center",   
    justifyContent: "center",
  },
  LoginBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    width: 120,          // fixed width
    height: 45,          // fixed height
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    position: "absolute",
  },

});

import React from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, ActivityIndicator, FlatList, ScrollView, KeyboardAvoidingView} from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as Progress from 'react-native-progress';
import {  saveUserCredentials } from '../../utils/auth';


export default function SignUpScreen() {
  const [UserName, setUsername] = React.useState("");
  const [Password, setPassword] = React.useState("");
  const [ConfirmPassword, setConfirmPassword] = React.useState("");
  const [FirstName, setFirstName] = React.useState("");
  const [LastName, setLastName] = React.useState("");
  const [Email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const navigation = useNavigation();
  const allFieldsFilled = UserName && Email && Password && ConfirmPassword && FirstName && LastName;
  const passwordsMatch = Password === ConfirmPassword;

  const handle_signup = () => {
    // const BASE_URL = 'http://192.168.1.144:8000'
    // const BASE_URL = 'http://192.168.1.93:8000'
    const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      
    if (!allFieldsFilled) {
      setError('All fields are required.');
      return;
    }
    if (!emailRegex.test(Email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!passwordRegex.test(Password)) {
      setError('Password do not match requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const timeout = (ms) =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), ms)
      );

  Promise.race([
    fetch(`${BASE_URL}/auth/signup`, {   // no trailing slash needed
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({username:UserName,first_name:FirstName, last_name:LastName, email:Email, password:Password })
    }),
    timeout(8000)
  ])
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        setLoading(false);
        if (data.detail && data.detail.includes("email")) {
          setError("Email is already in use.");
        } else {
          setError(data.detail || "Signup failed. Please try again.");
        }
        return;
      }
      const userInfo = {
        id: data["user_id"],
        email: Email,
        name: `${FirstName} ${LastName}`
      };
      await saveUserCredentials(data.access_token, data.refresh_token, userInfo);
      setLoading(false);
      navigation.navigate('Login');
    })
    .catch((error) => {
      setLoading(false);
      if (error.message === "Request timed out") {
        setError("Server took too long to respond. Please try again.");
      } else {
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
            <Text style={styles.title}>JINI</Text>
            <Image
                source={require("../../assets/genie-512.png")} // path to your PNG
                style={styles.icon}
                resizeMode="center" // ensures it scales properly
                />
        </View>
      </View>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, width: '100%' }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.middleSection} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="First Name" placeholderTextColor="#ffffff" value={FirstName} onChangeText={setFirstName} />
          </View>
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="Last Name" placeholderTextColor="#ffffff" value={LastName} onChangeText={setLastName} />
          </View>
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="Email" placeholderTextColor="#ffffff" value={Email} onChangeText={setEmail} autoCapitalize="none" />
          </View>
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="Username" placeholderTextColor="#ffffff" value={UserName} onChangeText={setUsername} autoCapitalize="none" />
          </View>
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="Password" placeholderTextColor="#ffffff" value={Password} onChangeText={setPassword} secureTextEntry={true} autoCapitalize="none" />
          </View>
          <View style={styles.fieldsBox}>
            <TextInput style={styles.fields} placeholder="Confirm Password" placeholderTextColor="#ffffff" value={ConfirmPassword} onChangeText={setConfirmPassword} secureTextEntry={true} autoCapitalize="none" />
          </View>
          <View style={styles.LoginBox}>
            <TouchableOpacity onPress={handle_signup} disabled={loading} style={styles.loginButton}>
              {loading ? (
                <Progress.Circle 
                  size={32} 
                  indeterminate={true} 
                  color="#007AFF" 
                  thickness={3}
                  style={styles.spinner}
                />
              ) : (
                <Text style={styles.title}>SIGN UP</Text>
              )}
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>    
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent"
  },
  middleSection: {
    alignItems: "center",
    marginTop: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
  },
  topSection: {
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
  },
  button: {
    backgroundColor: "#2D5C5C",
    fontFamily: "Bitter-Regular",
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
 
  
  logo: {
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },

  

  // signup: {
  //   backgroundColor: "#2D5C5C",
  //   fontFamily: "Bitter-Regular",
  //   paddingHorizontal: 20,
  //   paddingVertical: 10,
  //   borderRadius: 10,
  //   color: "#fff",
  //   fontSize: 32,
  //   alignContent: 'center',
  //   top: 20,
  // },
  // signupBox: {
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   marginTop: 20,
  //   position: 'relative',
  // },
  fields: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",

  },fieldsBox: {
    backgroundColor: "#2D5C5C",
    borderRadius: 10,
    width: "80%",
    paddingVertical: "1%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 20,
  },
  error: {
    position: 'absolute',
    top: 50,
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  },
  LoginBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    height: 45,          // fixed height
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    position: "absolute",
  },
});

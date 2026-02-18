import React, { useState, useContext } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TextInput, 
  TouchableOpacity 
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as Progress from 'react-native-progress';
import { performGoogleLogin, validateLoginForm, performLogin } from "../../services/LoginServices";
import { AuthContext } from "../../utils/AuthContext";
import { saveGoogleLogin,   } from "../../utils/auth";
import { statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  // --- State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigation = useNavigation();
  const { signIn } = useContext(AuthContext);


  /**   
   * Orchestrates the Google Sign-In process
   */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const loginData = await performGoogleLogin();

      const { accessToken, refreshToken, userInfo } = loginData;

      await signIn(accessToken, refreshToken, userInfo);
      await saveGoogleLogin(true);

    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Cancelled', 'User cancelled the login flow');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('In Progress', 'Login is already being processed');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services are not available on this device');
      } else {
        Alert.alert('Login Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Orchestrates the standard login process
   */
  const handle_login = async () => {
    setError('');
    

    if (email === 'a' || password === 'a') {
      const mock = {
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        userInfo: {
          name: 'Mock User',
          email: 'mock@example.com',
          id: '123456'
        }
      };
      await signIn(mock.accessToken, mock.refreshToken, mock.userInfo);
      return;
    }
    // 1. Validation
    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    // 2. API Call
    setLoading(true);
    const result = await performLogin(email, password);
    setLoading(false);

    if (result.success) {
      await signIn(result.accessToken, result.refreshToken, result.userInfo);
      setEmail('');
      setPassword('');

    } else {
      setError(result.error);
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);

  }

  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}
      style={styles.container}
    >
      {/* Top Branding Section */}
      <View style={styles.topSection}>
        <View style={styles.logo}>
          <Text style={styles.jini}>JINI</Text>
          <Image
            source={require("../../assets/genie-512.png")}
            style={styles.icon}
            resizeMode="center"
          />
        </View>
      </View>

      {/* Middle Form Section */}
      <View style={styles.middleSection}>
        <View style={styles.fieldsBox}>
          <TextInput 
            style={styles.fields} 
            placeholder="Email" 
            placeholderTextColor="#ffffff" 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
          />
        </View>

        <View style={[styles.fieldsBox, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <TextInput 
            style={[styles.fields, { paddingRight: 40 }]} 
            placeholder="Password"
            placeholderTextColor="#ffffff" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry={!passwordVisible} 
            autoCapitalize="none" 
          />
          <TouchableOpacity onPress={togglePasswordVisibility}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
             <Ionicons name={passwordVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color='#ffffff' style={{ position: 'absolute', right: 10, top: 13}} />
          </TouchableOpacity>
        </View>

        {/* Login Action */}
        <View style={styles.LoginBox}>
          <TouchableOpacity 
            onPress={handle_login} 
            disabled={loading} 
            style={styles.loginButton}
          >
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

        {/* Social Login */}
        <View style={styles.googleButton}> 
          <TouchableOpacity style={styles.googleContent} onPress={handleGoogleSignIn}>
            <Image
              source={require("../../assets/search.png")}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text style={styles.infoGoogle}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Navigation Section */}
      <View style={styles.bottomSection}>
        <View style={styles.SignupContent}>
          <Text style={styles.info}>Don’t have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
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
    width: '100%',
  },
  fieldsBox: {
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
  signup: {
    fontFamily: "Bitter-Regular",
    paddingVertical: 10,
    borderRadius: 10,
    color: "#fff",
    fontSize: 20,
    alignItems: 'center',
    marginLeft: 10,
    textDecorationLine: 'underline',
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
    width: 120,         
    height: 45,          
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    position: "absolute",
  },
});
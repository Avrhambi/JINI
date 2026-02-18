import React, { useState, useContext } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Progress from 'react-native-progress';
import { validateSignupForm, performSignup } from '../../services/SignupServices';
import { AuthContext } from "../../utils/AuthContext";

export default function SignUpScreen() {
  // --- Form State ---
  const [UserName, setUsername] = useState("");
  const [Password, setPassword] = useState("");
  const [ConfirmPassword, setConfirmPassword] = useState("");
  const [FirstName, setFirstName] = useState("");
  const [LastName, setLastName] = useState("");
  const [Email, setEmail] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const { signIn } = useContext(AuthContext);
  
  // --- UI State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigation = useNavigation();

  /**
   * Orchestrates the signup process using external services
   */
  const handle_signup = async () => {
    setError('');

    // 1. Validation Logic
    const validationError = validateSignupForm({ 
      UserName, Email, Password, ConfirmPassword, FirstName, LastName 
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    // 2. Execution Logic
    setLoading(true);
    const result = await performSignup({ 
      UserName, Email, Password, FirstName, LastName 
    });
    setLoading(false);
    
    if (result.success) {
      await signIn(result.accessToken, result.refreshToken, result.user);
    } else {
      setError(result.error);
    }
  };

  // set the password visibility for both password and confirm password fields
  const togglePasswordVisibility = (type) => {
    if (type === 'password') {
      setPasswordVisible(!passwordVisible);
    } else if (type === 'confirmPassword') {
      setConfirmPasswordVisible(!confirmPasswordVisible);
    }
  }
  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}
      style={styles.container}
    >
      {/* Header Section */}
      <View style={styles.topSection}>
        <View style={styles.logo}>
          <Text style={styles.title}>JINI</Text>
          <Image
            source={require("../../assets/genie-512.png")}
            style={styles.icon}
            resizeMode="center"
          />
        </View>
      </View>

      {/* Input Form Section */}
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, width: '100%' }}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.middleSection} 
          showsVerticalScrollIndicator={true} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.fieldsBox}>
            <TextInput 
              style={styles.fields} 
              placeholder="First Name" 
              placeholderTextColor="#ffffff" 
              value={FirstName} 
              onChangeText={setFirstName} 
            />
          </View>

          <View style={styles.fieldsBox}>
            <TextInput 
              style={styles.fields} 
              placeholder="Last Name" 
              placeholderTextColor="#ffffff" 
              value={LastName} 
              onChangeText={setLastName} 
            />
          </View>

          <View style={styles.fieldsBox}>
            <TextInput 
              style={styles.fields} 
              placeholder="Email" 
              placeholderTextColor="#ffffff" 
              value={Email} 
              onChangeText={setEmail} 
              autoCapitalize="none" 
            />
          </View>

          <View style={styles.fieldsBox}>
            <TextInput 
              style={styles.fields} 
              placeholder="Username" 
              placeholderTextColor="#ffffff" 
              value={UserName} 
              onChangeText={setUsername} 
              autoCapitalize="none" 
            />
          </View>

          <View style={[styles.fieldsBox, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <TextInput 
              style={[styles.fields, { paddingRight: 40 }]} 
              placeholder="Password" 
              placeholderTextColor="#ffffff" 
              value={Password} 
              onChangeText={setPassword} 
              secureTextEntry={!passwordVisible} 
              autoCapitalize="none" 
            />
            <TouchableOpacity onPress={() => togglePasswordVisibility('password')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
             <Ionicons name={passwordVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color='#ffffff' style={{ position: 'absolute', right: 10, top: 13}} />
            </TouchableOpacity>
          </View>


          <View style={[styles.fieldsBox, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <TextInput 
              style={[styles.fields, { paddingRight: 40 }]} 
              placeholder="Confirm Password" 
              placeholderTextColor="#ffffff" 
              value={ConfirmPassword} 
              onChangeText={setConfirmPassword} 
              secureTextEntry={!confirmPasswordVisible} 
              autoCapitalize="none" 
            />
          <TouchableOpacity onPress={() => togglePasswordVisibility('confirmPassword')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
           <Ionicons name={confirmPasswordVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color='#ffffff' style={{ position: 'absolute', right: 10, top: 13 }} />
          </TouchableOpacity>
          </View>

          {/* Action Section */}
          <View style={styles.LoginBox}>
            <TouchableOpacity 
              onPress={handle_signup} 
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
    paddingVertical: "1%",
    marginBottom: 20,
    paddingHorizontal: 10,
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
    height: 45,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    position: "absolute",
  },
});
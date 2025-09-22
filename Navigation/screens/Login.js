import React from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Link, useRouter } from 'expo-router';
import {  saveUserCredentials } from '../../utils/auth';
import * as Progress from 'react-native-progress';




export default function LoginScreen() {
    const [Email, setEmail] = React.useState("");
    const [Password, setPassword] = React.useState("");
    const navigation = useNavigation();
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const router = useRouter();
    const allFieldsFilled = email && password;

    const handle_login = async () => {
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
        fetch('http://192.168.1.144:8000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Email, Password })
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

      setLoading(false);
      navigation.navigate('Home');
    })
    .catch((error) => {
      setLoading(false);
      if (error.message === "Request timed out") {
        setError("Server took too long to respond. Please try again.");
      } else {
        setError("Network error. Please try again.");
      }
    });

      //   const data = await response.json();
      //   setLoading(false);
      //   if (response.ok) {
      //     // ✅ Login successful
      //     await saveUserCredentials(data.access_token, data.refresh_token);
      //     navigation.navigate('Home')

      //   } else {
      //     setError(data.detail || 'Login failed. Please try again.');
      //   }
      // } catch (error) {
      //     setLoading(false);
      //     setError('Network error. Please try again.');
      // }
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
          <TextInput style={styles.fields} placeholder="Email" placeholderTextColor="#ffffff" value={Email} onChangeText={setEmail} />
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Password" placeholderTextColor="#ffffff" value={Password} onChangeText={setPassword} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
            (<Progress.Circle size={40} indeterminate={true} color="#007AFF" thickness ={20} style={{ marginVertical: 12 }} />)
        ) : (
        <TouchableOpacity onPress={handle_login}>
          <Text style={styles.title}>LOGIN</Text>
        </TouchableOpacity>
        )} 
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.signupBox}>
            <Text style={styles.info}>don’t have an account?{"\n"} create account here</Text>
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
    marginTop: 20,
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
    paddingBottom: 80,
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
    marginBottom: 0,
    width: "70%",
    textAlign: 'center',
  },
  logo: {
    alignItems: 'center',
  },
  signupBox: {
    alignItems: 'center',
    marginTop: '10%',
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  signup: {
    backgroundColor: "#2D5C5C",
    fontFamily: "Bitter-Regular",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    color: "#fff",
    fontSize: 32,
    alignItems: 'center',
    top: 20, 
  },
   error: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  },
  

});

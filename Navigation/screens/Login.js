import React from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";




export default function LoginScreen() {
    const [Username, setUsername] = React.useState("");
    const [Password, setPassword] = React.useState("");
    const navigation = useNavigation();
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

      <View style={styles.middleSection}>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Username" placeholderTextColor="#ffffff" value={Username} onChangeText={setUsername} />
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Password" placeholderTextColor="#ffffff" value={Password} onChangeText={setPassword} />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.title}>LOGIN</Text>
        </TouchableOpacity>
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
    fontSize: 20,
    backgroundColor: "#2D5C5C",
    borderRadius: 10,
    width: "80%",
    paddingVertical: 10,
    marginBottom: 20,
    
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
    marginBottom: 0,
    position: "relative",
    top: 20, 
  },

});

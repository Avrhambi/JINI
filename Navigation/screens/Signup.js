import React from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";




export default function SignUpScreen() {
    const [Username, Password, ConfirmPassword, FirstName, LastName, Email] = React.useState("");
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
      
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="First Name" placeholderTextColor="#ffffff" value={FirstName}/>
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Last Name" placeholderTextColor="#ffffff" value={LastName}/>
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Email" placeholderTextColor="#ffffff" value={Email}/>
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Username" placeholderTextColor="#ffffff" value={Username}/>
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Password" placeholderTextColor="#ffffff" value={Password}/>
        </View>
        <View style={styles.fieldsBox}>
          <TextInput style={styles.fields} placeholder="Confirm Password" placeholderTextColor="#ffffff" value={ConfirmPassword}/>
        </View>
        <View style={styles.signupBox}>
          <TouchableOpacity  onPress={() => navigation.navigate('Home')}>
            <Text style={styles.signup}>SIGN UP</Text>
          </TouchableOpacity>
          <View style={styles.googleButton}>
            <Image
            source={require("../../assets/search.png")} // path to your PNG
            style={styles.googleIcon}
            resizeMode="center" 
            />
            <Text style={styles.info}>Continue with Google</Text>
          </View>            
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,   // like in your figma design
  },
  middleSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginBottom: 0,
  },
  topSection: {
    flex: 1,
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
  info: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginLeft: 20,
    width: "70%",
  },
  googleButton: {
    backgroundColor: "#ffffff",
    fontFamily: "Bitter-Regular",
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    top: 60,

  },
  logo: {
    alignItems: 'center',
  },
    googleIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
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
  signupBox: {
    alignItems: 'center',
    marginTop: '10%',
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column',
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

});

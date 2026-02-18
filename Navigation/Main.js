import { StyleSheet, Text, Image, TouchableOpacity } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";



export default function MainScreen() {
    const navigation = useNavigation();
    return (
    <LinearGradient
    colors={["#E1E6E7", "#ADC3C7", "#424242"]}
    locations={[0.25, 0.63, 1]}   // match your figma stops
    style={styles.container}
    >
        <Text style={styles.title}>JINI</Text>
        <Image
            source={require("../assets/genie-512.png")} // path to your PNG
            style={styles.icon}
            resizeMode="center" // ensures it scales properly
        />
        <TouchableOpacity style={styles.button} onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Login' }]}) }>
            <Text style={styles.buttonText}>GET STARTED</Text>
        </TouchableOpacity>
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
  title: {
    fontSize: 96,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginBottom: 0,
  },
  button: {
    backgroundColor: "#2D5C5C",
    fontFamily: "Bitter-Regular",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    color: "#fff",
    fontSize: 32,
    marginBottom: 50,
    position: "relative",
    top: 150, 
  },
  buttonText: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Bitter-Regular", 
  },
  icon: {
    width: 146,
    height: 146,
    marginBottom: 20,
      

  },
});

import React from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import {Audio} from 'expo-av';
import {Ionicons} from '@expo/vector-icons';
import Slider from "@react-native-community/slider";





export default function ListenScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { record } = route.params;

    //sound

    const [sound, setSound] = React.useState(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [position, setPosition] = React.useState(0);
    const [duration, setDuration] = React.useState(0);

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    async function loadAudio() {
        const { sound } = await Audio.Sound.createAsync(record.uri, { shouldPlay: false });
        setSound(sound);
        sound.setOnPlaybackStatusUpdate(updateStatus);
    }

    

  function updateStatus(status) {
    if (status.isLoaded) {
        setPosition(status.positionMillis / 1000);
        setDuration(status.durationMillis / 1000);
    }
  }

  React.useEffect(() => {
    loadAudio();
    return () => {
        if (sound) {
            sound.unloadAsync();
        }
    };
  }, []);

  async function togglePlay() {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
    setIsPlaying(!isPlaying);
  }

  async function seekAudio(value) {
    if (sound) {
      await sound.setPositionAsync(value * 1000);
    }
  }

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
          <Image
              source={require("../../assets/audio.png")} // path to your PNG
              style={styles.Audioicon}
          />
        </View>

        <View style={styles.bottomSection}>
          <Slider
              style={{ width: 300, height: 40 }}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={seekAudio}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#2e2e2e"
          />
          <View style={styles.timeRow}>
              <Text style={{ color: "#fff" }}>{formatTime(position)}</Text>
              <Text style={{ color: "#fff" }}>{formatTime(duration)}</Text>
          </View>

          <View style={styles.controls}>
              <Ionicons name="play-skip-back" size={30} color="#fff" />
              <TouchableOpacity onPress={togglePlay}>
                  <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={80} color="#fff" />
              </TouchableOpacity>
              <Ionicons name="play-skip-forward" size={30} color="#fff" />
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
  buttonText: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Bitter-Regular", 
  },
  logo: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginTop: 10,
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
  Audioicon: {
    width: 250,
    height: 190,
    resizeMode: "contain",
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 80,
  },
  meta: {
    fontSize: 20,
    marginBottom: 10
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "80%",
    marginTop: 20,
  },
  timeRow: {
    width: "80%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,

  },
});

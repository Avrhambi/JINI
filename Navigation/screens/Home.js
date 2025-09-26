import React, {useEffect, useState} from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, FlatList, Button, Alert } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {Audio} from "expo-av"
import { apiFetch } from "../../utils/api";




export default function HomeScreen() {
  const [KeyWord, setKeyWord] = useState("");
  const [records, setRecords] = useState([]);
  const navigation = useNavigation();
  // Path to audios folder
  const audioDir = FileSystem.documentDirectory + "audios/";

  // Create folder and load saved files on app start
  useEffect(() => {
    (async () => {
      const folderInfo = await FileSystem.getInfoAsync(audioDir);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      }

      const files = await FileSystem.readDirectoryAsync(audioDir);
      setAudioFiles(files);
    })();
        return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);
  
  function millisToMinutesAndSeconds(millis) {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }


  async function getAudioDuration(uri) {
    const { sound, status } = await Audio.Sound.createAsync(uri);
    const duration = status.durationMillis;
    await sound.unloadAsync();
    return duration;
  }
  // const testProtectedRequest = async () => {
  //   try {
  //     const { ok, data } = await apiFetch('/test/protected_request', { method: 'GET' });

  //     if (!ok) {
  //       Alert.alert('Request Failed', JSON.stringify(data));
  //     } else {
  //       Alert.alert('Success', JSON.stringify(data));
  //     }
  //   } catch (err) {
  //     Alert.alert('Error', err.message);
  //   }
  // };

  useEffect(() =>{
    async function fetchRecords() {
      const data = [
        { id: "1", title: "record1", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "2", title: "record2", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "3", title: "record3", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "4", title: "record4", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "5", title: "record5", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "6", title: "record6", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "7", title: "record7", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "8", title: "record8", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "9", title: "record9", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "10", title: "record10", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "11", title: "record11", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "12", title: "record12", uri: require("../../assets/audio/audio-sample2.mp3") },
        { id: "13", title: "record13", uri: require("../../assets/audio/audio-sample1.mp3") },
        { id: "14", title: "record14", uri: require("../../assets/audio/audio-sample2.mp3") },
      ];
    try {
      const withDurations = await Promise.all(data.map(async (rec) => {    
        try {
          const durationMs = await getAudioDuration(rec.uri);
          return { ...rec, duration: millisToMinutesAndSeconds(durationMs) };
        } catch (error) {
          console.error("Error fetching audio duration for:", rec.title, error);
          return { ...rec, duration: "Unknown" };
        }
    }));
        setRecords(withDurations);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
    }fetchRecords();});

  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}   // match your figma stops
      style={styles.container}
    >
      {/* <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Button title="Test Protected Request" onPress={testProtectedRequest} />
      </View> */}
      <View style={styles.topSection}>
        <View style = {styles.logo}>
        <Text style={styles.title}>JINI</Text>
        <Image
          source={require("../../assets/genie-512.png")} // path to your PNG
          style={styles.icon}
          resizeMode="center" // ensures it scales properly
        />
        </View>
        <View style={styles.SearchBar}>
          <TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor="#ffffff" value={KeyWord} onChangeText={setKeyWord} />
          <Image
          source={require("../../assets/magnifying-glass.png")} // path to your PNG
          style={styles.searchIcon}
          resizeMode="center" // ensures it scales properly
        />      
        </View>
        <Text style={styles.headLine}  > My Records </Text>
        <FlatList
          data={records.filter(r =>
            r.title.toLowerCase().includes(KeyWord.toLowerCase())
          )} // search filter
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
            <View style={styles.SearchResultItem}>
              <View>
                <Text style={styles.Results}>{item.title}</Text>
                <Text style={styles.ResultsInfo}>{item.duration}</Text>
              </View>
              <Image
                source={require("../../assets/record.png")}
                style={styles.RecordIcon}
                resizeMode="center"
              />
            </View>
            </TouchableOpacity>
          )}
        />
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
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginTop: 10,
  },
  headLine: {
    fontSize: 32,
    fontFamily: "Bitter-Regular",
    color: "#000",
    marginTop: 10,
    marginBottom: 10,
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
  logo: {
    alignItems: 'center',
  },
   SearchBar: {
    backgroundColor: "#2D5C5C",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
    marginTop: 20,
    paddingHorizontal: 20,

  },
    searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
  },
  SearchResultItem: {
    backgroundColor: "#2D5C5C",
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    justifyContent: "space-between",
    width: "90%",
    alignSelf: "center",
    marginBottom: 20,
  },
    RecordIcon: {
    width: 40,
    height: 40,
    marginLeft: 10,
  },
  Results: {
    fontSize: 16,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
  },
  ResultsInfo: {
    fontSize: 12,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
  },
  SearchResults: {
    flex: 1,
    padding: 10,
    backgroundColor: "#2D5C5C",
    borderRadius: 10,
    marginVertical: 5,
    marginBottom: 20,
    paddingVertical: 10,

  },

});

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, FlatList, Button, Alert, NativeModules, NativeEventEmitter, PermissionsAndroid } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av"
// import { apiFetch } from "../../utils/api";
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from "expo-document-picker";
import { requestStoragePermissions, requestAllFilesPermission } from "../../utils/premissions_old";
import { getCallRecordings } from "../../services/CallRecordService";
import RecordingService from "../../services/RecordingService";
import ShizukuModule from "../../modules/shizuku/ShizukuModule";
import { formatFileSize } from "../../utils/recordingUtils";
import ShizukuPermissions from "../../permissions/ShizukuPermissions";
// import CallLogModule from '../../android/app/src/main/java/com/anonymous/JINI/CallLogModule';
// import CallModule from '../../android/app/src/main/java/com/anonymous/JINI/CallModule';

export default function HomeScreen() {
  const [KeyWord, setKeyWord] = useState("");
  const [TestRecords, setTestRecords] = useState([]);
  const [expandedId, setExpandedId] = React.useState(null);
  const [favorites, setFavorites] = React.useState([]);
  const [currentTab, setCurrentTab] = React.useState("all"); // "all" | "favorites"
  const [audioFiles, setAudioFiles] = useState([]);
  const [sound, setSound] = useState(null);
  const [records, setRecords] = useState([]);
  const navigation = useNavigation();
  const { CallModule, CallLogModule } = NativeModules;


  // const loadRecords = async () => {
  //   // const storagePermission = await requestStoragePermissions();
  //   // if (!storagePermission) {
  //   //   console.log('No storage permission granted');
  //   //   return;
  //   // }
  //   // const allFilesPermission = await requestAllFilesPermission();
  //   // if (!allFilesPermission) {
  //   //   console.log('No all files permission granted');
  //   //   return;
  //   // }
  //   console.log('NativeModules.ShizukuModule:', NativeModules.ShizukuModule);

  //   // Initialize Shizuku and ensure permission
  //   const shizukuInitialized = await RecordingService.initialize();
  //   if (!shizukuInitialized) {
  //     Alert.alert(
  //       'Shizuku Setup Required',
  //       'Please ensure Shizuku is running and grant the necessary permissions to access call recordings.',
  //       [
  //         { text: 'Setup Later', style: 'cancel' },
  //         { text: 'Grant Permission', onPress: () => ShizukuPermissions.request() }
  //       ]
  //     );
  //     // Continue without Shizuku - will only show recordings already in public storage
  //   }

  //   try {
  //     // NEW: Sync new recordings from dialer using Shizuku
  //     if (shizukuInitialized) {
  //       const syncResult = await RecordingService.syncNewRecordings();
  //       if (syncResult.copiedCount > 0) {
  //         console.log(`Synced ${syncResult.copiedCount} new recordings`);
  //       }
  //     }

  //     const [logs, recordings] = await Promise.all([
  //       CallLogModule.getCallLogs(),
  //       getCallRecordings()
  //     ]);
  //     console.log('Call Logs:', logs);
  //     console.log('Recordings:', recordings);

  //     const merged = logs.map(log => {
  //       const logDate = parseInt(log.date);
  //       const match = recordings.find(
  //         r => Math.abs(r.modified - logDate) < 20000
  //       );
  //       return {
  //         ...log,
  //         metadata: {
  //           name: log.name || 'Unknown',
  //           number: log.number,
  //           type: log.type, // incoming/outgoing/missed
  //           duration: log.duration,
  //           date: new Date(logDate).toLocaleString(),
  //         },
  //         recording: match ? { name: match.name, path: match.path } : null
  //       };
  //     });
  //     setRecords(merged);
  // } catch (error) {
  //   console.error('Error loading records:', error);
  // }
  // };

  const loadRecords = async () => {
  console.log('NativeModules.ShizukuModule:', NativeModules.ShizukuModule);

  const shizukuInitialized = await RecordingService.initialize();
  if (!shizukuInitialized) {
    Alert.alert(
      'Shizuku Setup Required',
      'Please ensure Shizuku is running and grant the necessary permissions to access call recordings.',
      [
        { text: 'Setup Later', style: 'cancel' },
        { text: 'Grant Permission', onPress: () => ShizukuPermissions.request() }
      ]
    );
    return;
  }

  try {
    // Sync new recordings from private dialer
    const syncResult = await RecordingService.syncNewRecordings();
    if (syncResult.copiedCount > 0) {
      console.log(`Synced ${syncResult.copiedCount} new recordings`);
    }

    // Get call logs and recordings
    const [logs, recordings] = await Promise.all([
      CallLogModule.getCallLogs(),
      RecordingService.getExistingPublicRecordings()
    ]);

    // Match only logs that have recordings
    const filteredLogs = logs
      .map(log => {
        const logDate = parseInt(log.date);
        const match = recordings.find(
          r => Math.abs(r.mtime - logDate) < 20000
        );
        if (!match) return null; // skip logs without recordings

        return {
          ...log,
          recording: match,
          metadata: {
            name: log.name || 'Unknown',
            number: log.number,
            type: log.type,
            duration: log.duration,
            date: new Date(logDate).toLocaleString(),
          }
        };
      })
      .filter(Boolean); // remove nulls

    setRecords(filteredLogs);

  } catch (error) {
    console.error('Error loading records:', error);
    Alert.alert('Error', 'Failed to load call logs or recordings.');
  }
};



  useEffect(() => {
    loadRecords();
    const emitter = new NativeEventEmitter(CallModule);
    const subscription = emitter.addListener('onRecordingSaved', () => {
      loadRecords();
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

  async function listAudios() {
    try {
      // make sure directory exists
      const dirInfo = await FileSystem.getInfoAsync(audioDir);
      if (!dirInfo.exists) {
        console.log("No audios folder yet at:", audioDir);
        return;
      }

      // read all files in audios/
      const files = await FileSystem.readDirectoryAsync(audioDir);
      if (files.length === 0) {
        console.log("No audio files found in:", audioDir);
      } else {
        console.log("Audio files in:", audioDir);
        files.forEach((f) => console.log(" - " + f));
      }
    } catch (err) {
      console.error("Error reading audio dir:", err);
    }
  }

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      // Check for cancellation (newer API)
      if (result.canceled) {
        console.log("User cancelled document picker");
        return;
      }

      // Get the first selected file
      const file = result.assets[0];
      const destPath = audioDir + file.name;

      console.log("Selected file:", file.name);
      console.log("Destination path:", destPath);

      try {
        // --- Save to local folder ---
        await FileSystem.copyAsync({
          from: file.uri,
          to: destPath,
        });

        console.log("File saved locally at:", destPath);

        // Update state
        setAudioFiles((prev) => [...prev, file.name]);

        // --- Upload to backend from local folder ---
        const formData = new FormData();
        formData.append("audio", {
          uri: destPath,
          name: file.name,
          type: file.mimeType || "audio/mpeg",
        });

        console.log("Uploading to backend...");

        const BASE_URL = 'http://10.0.2.2:8000'
        const response = await fetch(`${BASE_URL}/calls/upload_audio`, {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          console.log("Upload failed:", data);
          Alert.alert("Upload Failed", JSON.stringify(data));
        } else {
          console.log("Upload success:", data);
          Alert.alert("Success", "Audio uploaded successfully!");
          await listAudios();
        }
      } catch (err) {
        console.error("Error while saving/uploading audio:", err);
        Alert.alert("Error", `Failed to upload: ${err.message}`);
      }
    } catch (err) {
      console.error("Error picking document:", err);
      Alert.alert("Error", `Failed to pick file: ${err.message}`);
    }
  };


  //   const pickAudio = async () => {
  //   const result = await DocumentPicker.getDocumentAsync({
  //     type: "audio/*",
  //     copyToCacheDirectory: true,
  //   });

  //   if (result.type === "success") {
  //     const destPath = audioDir + result.name;

  //     try {
  //       // --- Save to local folder ---
  //       await FileSystem.copyAsync({
  //         from: result.uri,
  //         to: destPath,
  //       });

  //       // Update state
  //       setAudioFiles((prev) => [...prev, result.name]);

  //       // --- Upload to backend from local folder ---
  //       const formData = new FormData();
  //       formData.append("audio", {
  //         uri: destPath,                 // now using the saved local copy
  //         name: result.name,
  //         type: result.mimeType || "audio/mpeg",
  //       });
  //       const BASE_URL = 'http://10.0.2.2:8000'
  //       const response = await fetch(`${BASE_URL}/calls/upload_audio`, {
  //         method: "POST",
  //         body: formData,
  //         headers: {
  //           "Content-Type": "multipart/form-data",
  //         },
  //       });

  //       if (!response.ok) {
  //         const data = await response.json();
  //         console.log("Upload failed:", data);
  //       } else {
  //         const data = await response.json();
  //         console.log("Upload success:", data);
  //         listAudios();
  //       }
  //     } catch (err) {
  //       console.log("Error while saving/uploading audio:", err);
  //     }
  //   }
  // };

  // Add this playAudio function
  const playAudio = async (fileName) => {
    try {
      // Stop any currently playing sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      const filePath = audioDir + fileName;
      console.log("Playing audio from:", filePath);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: true }
      );

      setSound(newSound);

      // Optional: Handle when audio finishes playing
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (err) {
      console.error("Error playing audio:", err);
      Alert.alert("Error", `Failed to play audio: ${err.message}`);
    }
  };


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

  useEffect(() => {
    async function fetchRecords() {
      const data = [
        { id: "1", title: "record1", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-01", caller: "John Doe", phoneNumber: "123-456-7890" },
        { id: "2", title: "record2", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-02", caller: "Jane Smith", phoneNumber: "234-567-8901" },
        { id: "3", title: "record3", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-03", caller: "Alice Johnson", phoneNumber: "345-678-9012" },
        { id: "4", title: "record4", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-04", caller: "Bob Brown", phoneNumber: "456-789-0123" },
        { id: "5", title: "record5", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-05", caller: "Charlie Davis", phoneNumber: "567-890-1234" },
        { id: "6", title: "record6", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-06", caller: "Diana Evans", phoneNumber: "678-901-2345" },
        { id: "7", title: "record7", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-07", caller: "Ethan Foster", phoneNumber: "789-012-3456" },
        { id: "8", title: "record8", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-08", caller: "Fiona Green", phoneNumber: "890-123-4567" },
        { id: "9", title: "record9", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-09", caller: "George Harris", phoneNumber: "901-234-5678" },
        { id: "10", title: "record10", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-10", caller: "Hannah Ivers", phoneNumber: "012-345-6789" },
        { id: "11", title: "record11", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-11", caller: "Ian Johnson", phoneNumber: "123-456-7890" },
        { id: "12", title: "record12", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-12", caller: "Jack Daniels", phoneNumber: "234-567-8901" },
        { id: "13", title: "record13", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-13", caller: "Karen White", phoneNumber: "345-678-9012" },
        { id: "14", title: "record14", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-14", caller: "Liam Brown", phoneNumber: "456-789-0123" },
      ];
      try {
        const withDurations = await Promise.all(data.map(async (rec) => {
          try {
            const durationMs = await getAudioDuration(rec.uri);
            return { ...rec, duration: millisToMinutesAndSeconds(durationMs), expanded: false, favorite: false };
          } catch (error) {
            return { ...rec, duration: "Unknown", expanded: false, favorite: false };
          }
        }));
        setTestRecords(withDurations);
      } catch (error) {
        console.error("Error fetching records:", error);
      }
    }
    fetchRecords();
  });

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}   // match your figma stops
      style={styles.container}
    >
      <View style={styles.topSection}>
        <View style={styles.menu}>
          <View style={styles.logo}>
            <Text style={styles.title}>JINI</Text>
            <Image
              source={require("../../assets/genie-512.png")} // path to your PNG
              style={styles.icon}
              resizeMode="center" // ensures it scales properly
            />
          </View>
          <TouchableOpacity style={styles.buttonText} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in-outline" size={35} color="black" ></Ionicons>
          </TouchableOpacity>
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
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabButton, currentTab === "all" && styles.activeTab]} onPress={() => {
            setCurrentTab("all");
          }}>
            <Text style={[styles.tabText, currentTab === "all" && styles.activeTabText]}>All</Text>
          </TouchableOpacity>
          {/* filter all the favorites */}

          <TouchableOpacity style={[styles.tabButton, currentTab === "favorites" && styles.activeTab]} onPress={() => {
            setCurrentTab("favorites");
          }}>

            <Text style={[styles.tabText, currentTab === "favorites" && styles.activeTabText]}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* <View >
          <Ionicons name="mic" size={24} color="white" />
          <Ionicons name= "star" size={24} color="white" />
        </View> */}

        <FlatList
          data={records.filter(r =>{
            const matchesSearch = r.metadata?.name?.toLowerCase().includes(KeyWord.toLowerCase()) ||
                                r.metadata?.number?.includes(KeyWord);
            const matchesTab = currentTab === "all" || 
                              (currentTab === "favorites" && favorites.includes(r.recording?.name));
            return matchesTab && matchesSearch;
            }
          )}
          // data= {null}
          // those are the actual records, but showing just the metadata
          // data={records} // 
          keyExtractor={(item) => item.id || item.recording?.name + item.metadata?.date}
          contentContainerStyle={{ paddingBottom: 40 }}

          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
              <View style={styles.SearchResultItem}>
                <TouchableOpacity onPress={() => toggleExpand(item.recording?.name)}>
                  <Ionicons name={expandedId === item.recording?.name ? "chevron-down" : "chevron-forward"} size={25} color="white"
                    resizeMode="center" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.Results}>{item.metadata?.name || 'Unknown'}</Text>
                  <Text style={styles.ResultsInfo}>{item.metadata?.type} • {item.metadata?.duration}s {item.recording && ' • 🎤 Recorded'}</Text>
                </View>
                {/* if the star is pressed it fill its else it is empty */}
                <TouchableOpacity onPress={() => toggleFavorite(item.recording?.name)}>
                  <Ionicons name={favorites.includes(item.recording?.name) ? "star" : "star-outline"} size={25} color="white"
                    resizeMode="center"
                  />
                </TouchableOpacity>
              </View>
              {expandedId === item.recording?.name && (
                <View style={styles.expandedResult}>
                  <Text style={styles.expandedResultsInfo}>Phone: {item.metadata?.number}</Text>
                  <Text style={styles.expandedResultsInfo}>Date: {item.metadata?.date}</Text>
                  <Text style={styles.expandedResultsInfo}>Type: {item.metadata?.type} </Text>
                  {item.recording ? (
                    <>
                      <Text style={styles.expandedResultsInfo}>
                        Recording: {item.recording.name}
                      </Text>
                      {item.recording.size && (
                        <Text style={styles.expandedResultsInfo}>
                          Size: {formatFileSize(item.recording.size)}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.expandedResultsInfo, { fontStyle: 'italic' }]}>
                      No recording available
                    </Text>
                  )}
                </View>
              )}
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
    justifyContent: 'center',
    flex: 1,
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
  expandedResult: {
    backgroundColor: "#6C9E9E",
    padding: 10,
    width: "90%",
    borderRadius: 20,
    alignSelf: "center",
    marginTop: -20,
    marginBottom: 10,
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
  expandedResultsInfo: {
    fontSize: 15,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
    marginLeft: 10,
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
  tabButton: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    backgroundColor: "#2D5C5C",

    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
  },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "60%",
    marginBottom: 10,
  },

  buttonText: {
    position: "absolute",
    right: 20,
    top: "50%",
    transform: [{ translateY: -17 }],

  },
  menu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

});

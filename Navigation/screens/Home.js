import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, FlatList, Alert, NativeModules, NativeEventEmitter } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from "expo-document-picker";
import { requestAppPermissions } from "../../utils/permissions"; 
import { formatFileSize } from "../../utils/recordingUtils";
import Modal from "react-native-modal";
import { getAudioFileInfo, findMatchInLogs, buildFullMetadata } from "../../utils/RecordManager";
import { getAccessToken, getUserInfo, removeUserCredentials } from "../../utils/auth";  


export default function HomeScreen() {
    const [KeyWord, setKeyWord] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [currentTab, setCurrentTab] = useState("all");
    const [records, setRecords] = useState([]);
    const [allRecords, setAllRecords] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = React.useState('Guest');
    const [isRenameModalVisible, setRenameModalVisible] = React.useState(false);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [newDisplayName, setNewDisplayName] = React.useState("");
    const [submittedQuery, setSubmittedQuery] = React.useState("");

    // const BASE_URL = 'http://172.18.124.55:8000';
    const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;



  
    const navigation = useNavigation();
    const { CallLogModule } = NativeModules; // Ensure this Native Module exists in your android folder

    // Path to local audios folder
    // const audioDir = FileSystem.documentDirectory + "audios/";
    const audioDir = FileSystem.documentDirectory + "PhoneRecords/";
    // Ensure folder exists on mount
    useEffect(() => {
        (async () => {
        const folderInfo = await FileSystem.getInfoAsync(audioDir);
        if (!folderInfo.exists) {
            await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
        }
        })();
    }, []);



    const loadRecords = async () => {
        console.log("in LoadRecords");
        try {
          const [savedNamesStr, savedFavsStr] = await Promise.all([
            AsyncStorage.getItem('custom_names'),
            AsyncStorage.getItem('favorite_records')
          ]);

          const customNames = savedNamesStr ? JSON.parse(savedNamesStr) : {};
          const localFavorites = savedFavsStr ? JSON.parse(savedFavsStr) : [];
          
          // Update the favorites state immediately so UI looks correct while loading
          setFavorites(localFavorites);
              const userInfo = await getUserInfo();
              const token = await getAccessToken(); 

            const [logs, fileNames] = await Promise.all([
                NativeModules.CallLogModule.getCallLogs(),
                FileSystem.readDirectoryAsync(audioDir)
            ]);

            const localMerged = await Promise.all(fileNames.map(async (name) => {
                if (name.includes('(') || name.includes('copy')) return null;
                const stats = await getAudioFileInfo(audioDir + name);
                if (stats.size === 0 || stats.duration === 0) return null;
                const timestampMatch = name.match(/\d{13}/);
                const fileTimestamp = timestampMatch ? parseInt(timestampMatch[0]) : null;

                const match = findMatchInLogs(name, fileTimestamp, stats.modificationTime, logs);
                if (!match) return null;

                const metadata = await buildFullMetadata(match, stats, name);

                return {
                    ...match,
                    recording: { name, uri: audioDir + name, ...stats },
                    metadata: metadata,
                    isLocal : true,
                    isFavorite: localFavorites.includes(name)
                };
            }));

            const filterLocal = localMerged.filter(Boolean);
            filterLocal.sort((a, b) => {
                const dateA = parseInt(a.date);
                const dateB = parseInt(b.date);
                return dateB - dateA; // Sort descending
            });
            console.log(`Loaded ${filterLocal.length} local records.`);
            setRecords(filterLocal);
            setAllRecords(filterLocal);
            console.log("userinfo", `${userInfo.name}`, `${userInfo.email}`,"token", `${token}`);

            // if (userInfo.id && token){
                // try {
                //     const controller = new AbortController();
                //     const timeoutId = setTimeout(() => controller.abort(), 8000);
                //     const response = await fetch(`${BASE_URL}/users/${userInfo.id}/loaded-records`, {
                //         headers: { 'Authorization': `Bearer ${token}` },
                //         signal: controller.signal
                //     }); 
                //     clearTimeout(timeoutId);
                //     if (response.ok) {
                //         const {serverRecords, favorite_record_ids} = await response.json();
                //         setFavorites(favorite_record_ids || []);

                //         if (serverRecords && serverRecords.length > 0) {
                //             setRecords(prev => {
                //                 const localNames = new Set(prev.map(r => r.recording.name));
                //                 const newServerRecords = serverRecords.filter(sr => !localNames.has(sr.filename))
                //                 .map(sr => ({
                //                     ...sr.metadata,
                //                     recording: {
                //                         name: sr.filename,
                //                         uri: null,
                //                         isCloud : true},
                //                     isLocal: false
                //                 }));
                //                 return [...prev, ...newServerRecords].sort((a, b) => {
                //                     new Date(b.date) - new Date(a.date);
                //                 });
                //             });
                //         }
                //     }
                // } catch (error) {
                //     console.error('Server Error:', error);
                // }
            }
        // } 
        catch (error) {
            console.log('Load Error:', error);
        }
    };


  // AUTOMATED REFRESH: Runs whenever you open the screen

  useFocusEffect(
  useCallback(() => {
    const init = async () => {
      setKeyWord(""); 
      setSubmittedQuery(""); // Reset search when entering screen
      const hasPermissions = await requestAppPermissions();
      if (hasPermissions) {
        loadRecords();
      }
    };
    init();
  }, [])
);

  const search_key_word = async () => {
    const query = KeyWord.trim();
    setSubmittedQuery(query);
    if (!query) {
      // If search is empty, reload original records
      setRecords(allRecords);
      return;
    }

    setRefreshing(true);

    try {
        // 1. Get the token for authentication
        const token = await getAccessToken();
        console.log("in search_key_word");
        if (!token) {
            Alert.alert("Error", "Session expired. Please log in again.");
            setRecords(allRecords);
            setKeyWord("");
            setSubmittedQuery("");
            setRefreshing(true);
            return;
        }

        const formData = new FormData();
        formData.append('query', KeyWord);
        console.log("Searching for keyword:", KeyWord);
        const responsePromise = fetch(`${BASE_URL}/calls/search`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const response = await responsePromise;
        console.log("Response received for search.",response);

        if (!response.ok) {
            throw new Error("Search failed on server");
        }

        const searchData = await response.json(); 
        console.log("Search data received:", searchData);
        /* Expected searchData format: 
            [ { "filename": "rec_123.mp3", "timestamps": [12.5, 45.0, 110.2] }, ... ]
        */

        // Filter our local records state to only show those found by the backend
        const filteredResults = allRecords.map(record => {
            const serverMatch = searchData.find(s => s.file_name === record.recording.name);
            
            if (serverMatch) {
            return {
                ...record,
                foundTimestamps: serverMatch.time_stamps // Attach timestamps for Listen.js
            };
            }
            return null;

        }).filter(Boolean);
        console.log(`Search found ${filteredResults[0]}`);
        if (filteredResults.length === 0) {
            console.log("No matches found. Check if your record.recording.name matches the server file_name.");
            Alert.alert("No Results", "No recordings matched your search keyword.");
            setRecords(allRecords); // Reset to all records
        }
        else {
          setRecords(filteredResults);
        }

    } catch (error) {
      console.log("Search error:", error.message);
      Alert.alert("Search Error", error.message === "Request timed out" 
        ? "Server took too long" 
        : "Failed to fetch search results.");
        setRecords(allRecords); // Reload original records on error
    } finally {
      setRefreshing(false);
    }
  };


  
//     const search_key_word = async () => {
//         if (!KeyWord.trim()) {
//             loadRecords();
//             return;
//         }

//     setRefreshing(true);

//   // --- MOCK BACKEND SIMULATION ---
//   // Simulate a 1-second delay
//   await new Promise(resolve => setTimeout(resolve, 1000));

//   // This is exactly what your backend SHOULD return
//   const mockSearchData = [
//     {
//       "filename": records[0]?.recording?.name || "example.mp3", 
//       "timestamps": [1, 2, 3.1, 6.2, 9.2, 10.5] // Seconds where keyword was found
//     },
//     {
//       "filename": records[1]?.recording?.name || "sample.mp3",
//       "timestamps": [1.0,2, 5.0, 6.5, 7]
//     }
//   ];

//   // Process the results just like the real fetch would
//   const filteredResults = records.map(record => {
//     const serverMatch = mockSearchData.find(s => s.filename === record.recording.name);
    
//     if (serverMatch) {
//       return {
//         ...record,
//         foundTimestamps: serverMatch.timestamps // This passes to Listen screen
//       };
//     }
//     return null;
//   }).filter(Boolean);

//   setRecords(filteredResults);
//   setRefreshing(false);
  
//   if (filteredResults.length > 0) {
//     Alert.alert("Mock Success", `Found keyword at ${filteredResults[0].foundTimestamps.length} positions`);
//   }
// };
  
const pickAudio = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
        if (result.canceled) return;
        const file = result.assets[0];

        // 1. Save Locally
        const destPath = audioDir + file.name;
        await FileSystem.copyAsync({ from: file.uri, to: destPath });

        // 2. Get Data via Helpers
        const stats = await getAudioFileInfo(destPath);
        const token = await getAccessToken(); 
        const userInfo = await getUserInfo();

        if (!token) {
            Alert.alert("Error", "You are not logged in. Please log in again.");
            return;
        }


        const logs = await NativeModules.CallLogModule.getCallLogs();
        const timestampMatch = file.name.match(/\d{13}/);
        const fileTimestamp = timestampMatch ? parseInt(timestampMatch[0]) : null;

        const matchedLog = findMatchInLogs(file.name, fileTimestamp, stats.modificationTime, logs);

        // 3. Prepare Metadata
        let finalMetadata;
        if (matchedLog) {
            finalMetadata = await buildFullMetadata(matchedLog, stats, file.name);
        } else {
            // Manual fallback if no log matches
            finalMetadata = {
                visibleName: file.name,
                originalFileName: file.name,
                caller_name: "Imported",
                number: "Unknown",
                type: "Manual",
                // realDuration: stats.duration,
                date: new Date().toLocaleString('he-IL'),
                // uploadedBy: userInfo.email || 'Unknown',
                // userId: userInfo.id || null,
                // userDisplayName: userInfo.name || 'Unknown',
            };
        }

        // 4. Upload

        const formData = new FormData();
        formData.append('audio_file', { uri: file.uri, name: file.name, type: file.mimeType || 'audio/wav' });
        formData.append('original_name', file.name);
        formData.append('display_name', finalMetadata.visibleName);
        formData.append('caller_name', finalMetadata.caller_name); 
        formData.append('number', finalMetadata.number);
        formData.append('type', finalMetadata.type);
        formData.append('date', finalMetadata.date || new Date().toISOString());  
        console.log("Uploading audio:", formData);
        const response = await fetch(`${BASE_URL}/calls/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`},
            body: formData,
        });

        if (response.ok) {
            const serverData = await response.json();
            // Save transcription for Listen.js
            await AsyncStorage.setItem(`transcription_${file.name}`, JSON.stringify(serverData));
            Alert.alert("Success", "Uploaded and transcribed!");
            Alert.alert("Success", "Uploaded and transcribed!");
            loadRecords(); // Refresh UI
        }
        else {
            const errorData = await response.json();
            Alert.alert("Upload Error", errorData.detail || "Upload failed. Please try again.");
        }
    } catch (err) {
        console.error("pickAudio Error:", err);
        Alert.alert("Error", "Import failed");
    }
};
 
  const toggleFavorite =  async (recordName) => {
    const token = await getAccessToken();
    const userInfo = await getUserInfo();
    console.log("Toggling favorite for:", recordName);
    if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
    }
    const isFavorite = favorites.includes(recordName);
    const endpoint = isFavorite ? 'remove' : 'add';
    const formData = new FormData();
    formData.append('original_name', recordName);
    try {
        const response = await fetch(`${BASE_URL}/calls/favorites/${endpoint}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`}, 
            body: formData,
        });
        if (response.ok) {
          const updatedFavorites = isFavorite 
            ? favorites.filter((fid) => fid !== recordName) 
            : [...favorites, recordName];

          setFavorites(updatedFavorites);
          await AsyncStorage.setItem(`favorite_records`, JSON.stringify(updatedFavorites));
            
        } else {
            const errorData = await response.json();
            Alert.alert("Error", errorData.detail || "Could not update favorites.");
            console.error("Favorite Error:", errorData);
        }
    } catch (error) {
        Alert.alert("Error", "Network error. Please try again.");
    }
};

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  React.useEffect(() => {
  const getUserName = async () => {
    try {
      const userInfo = await getUserInfo();
      if (userInfo.name) setUserName(userInfo.name);
    } catch (e) {
      console.log("Failed to load user name");
    }
  };

  getUserName();
}, []);

// const handleLogout = async () => {
//   try {
//     setMenuVisible(false);
    
//     // Clear tokens and the name
//     await AsyncStorage.multiRemove(['user_name', 'access_token', 'refresh_token']);

//     navigation.reset({
//       index: 0,
//       routes: [{ name: 'Login' }],
//     });
//   } catch (error) {
//     console.error("Logout error:", error);
//   }
// };


const handleLogout = async () => {
  try {
    setMenuVisible(false);
    
    // Wipe everything (Tokens AND User Info) via the helper
    await removeUserCredentials();

    // Clear any lingering non-secure items if you still use them
    await AsyncStorage.removeItem('user_name');

    // Redirect to Login and prevent going back
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });

    console.log("User logged out successfully.");
  } catch (error) {
    console.error("Logout error:", error);
    Alert.alert("Error", "Could not log out properly. Please try again.");
  }
};

const handleDeleteAccount = async () => {

  Alert.alert(
    "Delete Account",
    "Are you sure? This will permanently delete all your records and account data.",
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            console.log("Deleting account...");
            const token = await getAccessToken();
            const response = await fetch(`${BASE_URL}/users/delete`, {
              method: 'DELETE',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
              },
            });

            if (response.ok) {
                setRecords([]); // Clear records from UI
                setAllRecords([]);
                setFavorites([]);
                console.log("Account deleted successfully.");
                // Cleanup local storage
                await Promise.all([
                  removeUserCredentials(),
                  AsyncStorage.removeItem('favorite_records'),
                  AsyncStorage.removeItem('custom_names'),
                  AsyncStorage.removeItem('user_name')
                ]);

                setMenuVisible(false);
                
                // Reset navigation to Signup
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                });
            } else {
              Alert.alert("Error", "Could not delete account. Please try again.");
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]
  );
};

// RENAME RECORD
const renameRecord = async (recordName, newName) => {
  console.log("Renaming record:", recordName, "to", newName);
  try {
    const token = await getAccessToken();
    const userInfo = await getUserInfo();
    if (!token) {
      Alert.alert("Error", "Session expired. Please log in again.");
      return;
    }
    const formData = new FormData();
    formData.append('original_name', recordName);
    formData.append('new_name', newName);
    const response = await fetch(`${BASE_URL}/calls/rename`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (response.ok) {
      // Update UI locally without reloading everything
      setRecords(prev => prev.map(r => 
        r.recording.name === recordName ? { ...r, metadata: { ...r.metadata, visibleName: newName } } : r
      ));
      const savedNames = await AsyncStorage.getItem('custom_names');
      const namesObj = savedNames ? JSON.parse(savedNames) : {};
      namesObj[recordName] = newName; // Mapping: "audio_123.mp3" -> "Mom's Call"
      await AsyncStorage.setItem('custom_names', JSON.stringify(namesObj));
    }
  } catch (error) {
    Alert.alert("Error", "Could not rename record.");
  }
};

// DELETE RECORD
const deleteRecord = async (record) => {
    const recordName = record.recording.name;
    const userInfo = await getUserInfo();
    const token = await getAccessToken();
    if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
    }

    Alert.alert("Delete", "Are you sure you want to delete this recording?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
        try {
          console.log("Deleting record:", recordName);
          const formData = new FormData();
          formData.append('original_name', recordName);
            // 1. Delete from Database
          const response = await fetch(`${BASE_URL}/calls/delete`,
          {
            method: 'DELETE',
            headers: { 
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          });
          
          if (response.ok) {
            // 2. Delete from App Storage (FileSystem)
            await FileSystem.deleteAsync(record.recording.uri);
            const savedNames = await AsyncStorage.getItem('custom_names');
            if (savedNames) {
                let namesObj = JSON.parse(savedNames);
                delete namesObj[recordName]; // Remove the entry for this file
                await AsyncStorage.setItem('custom_names', JSON.stringify(namesObj));
            }
            
            // 3. Update UI
            setRecords(prev => prev.filter(r => r.recording.name !== record.recording.name));
          }
        } catch (error) {
          Alert.alert("Error", "Deletion failed.");
        }
    }}
  ]);
};

const openRenameModal = (record) => {
  setSelectedRecord(record);
  setNewDisplayName(record.metadata.visibleName); // Pre-fill with current name
  setRenameModalVisible(true);
};


  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}
      style={styles.container}
    >
      <View style={styles.topSection}>
        {/* Header */}
        <View style={styles.menu}>
          <View style={styles.logo}>
            <Text style={styles.title}>JINI</Text>
            <Image
              source={require("../../assets/genie-512.png")}
              style={styles.icon}
              resizeMode="center"
            />
          </View>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={35} color="black" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.SearchBar}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search" 
            placeholderTextColor="#ffffff" 
            value={KeyWord} 
            onChangeText={setKeyWord}
            onSubmitEditing={search_key_word} // Trigger search on "Enter"
            returnKeyType="search"
          />
          <TouchableOpacity onPress={search_key_word}>
            <Image
              source={require("../../assets/magnifying-glass.png")}
              style={styles.searchIcon}
              resizeMode="center"
            />
          </TouchableOpacity>
        </View>

        {/* Action Bar (Manual Import) */}
        <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignItems: 'center'}}>
            <Text style={styles.headLine}>My Records</Text>
            <TouchableOpacity onPress={pickAudio} style={{padding: 5}}>
                <Ionicons name="add-circle-outline" size={30} color="#2D5C5C" />
            </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tabButton, currentTab === "all" && styles.activeTab]} 
            onPress={() => setCurrentTab("all")}
          >
            <Text style={[styles.tabText, currentTab === "all" && styles.activeTabText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, currentTab === "favorites" && styles.activeTab]} 
            onPress={() => setCurrentTab("favorites")}
          >
            <Text style={[styles.tabText, currentTab === "favorites" && styles.activeTabText]}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={records.filter(r => {
            // const matchesSearch = r.metadata?.name?.toLowerCase().includes(KeyWord.toLowerCase()) ||
            //                       r.metadata?.number?.includes(KeyWord) || (r.foundTimestamps && r.foundTimestamps.length > 0);
            if (!submittedQuery) return currentTab === "all" || (currentTab === "favorites" && favorites.includes(r.recording?.name));
            const matchesSearch = (r.foundTimestamps && r.foundTimestamps.length > 0);
            const matchesTab = currentTab === "all" || 
                              (currentTab === "favorites" && favorites.includes(r.recording?.name));
            return matchesTab && matchesSearch;
          })}
          extraData={records}
          keyExtractor={(item) => `${item.date}-${item.recording.name}`}
          contentContainerStyle={{ paddingBottom: 40, width: "100%" }}
          ListEmptyComponent={
          <Text style={{textAlign: 'center', marginTop: 20, color: '#555'}}>
              No records found with attached audio.
          </Text>
          }
        //   renderItem={({ item }) => (
        //     <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
        //       <View style={styles.SearchResultItem}>
        //         <TouchableOpacity onPress={() => toggleExpand(item.recording?.name)}>
        //           <Ionicons 
        //             name={expandedId === item.recording?.name ? "chevron-down" : "chevron-forward"} 
        //             size={25} 
        //             color="white"
        //           />
        //         </TouchableOpacity>
        //         <View style={{ flex: 1, marginLeft: 10 }}>
        //           <Text style={styles.Results}>{item.metadata?.name || 'Unknown'}</Text>
        //           <Text style={styles.ResultsInfo}>
        //             {item.metadata?.type} • {item.metadata?.duration}s • 🎤
        //           </Text>
        //         </View>
        //         <TouchableOpacity onPress={() => toggleFavorite(item.recording?.name)}>
        //           <Ionicons 
        //             name={favorites.includes(item.recording?.name) ? "star" : "star-outline"} 
        //             size={25} 
        //             color="white"
        //           />
        //         </TouchableOpacity>
        //       </View>
              
        //       {expandedId === item.recording?.name && (
        //         <View style={styles.expandedResult}>
        //           <Text style={styles.expandedResultsInfo}>Phone: {item.metadata?.number}</Text>
        //           <Text style={styles.expandedResultsInfo}>Date: {item.metadata?.date}</Text>
        //           <Text style={styles.expandedResultsInfo}>File: {item.recording.name}</Text>
        //           <Text style={styles.expandedResultsInfo}>
        //             Size: {formatFileSize ? formatFileSize(item.recording.size) : item.recording.size}
        //           </Text>
        //         </View>
        //       )}
        //     </TouchableOpacity>
        //   )}
        renderItem={({ item }) => {
    // Helper to convert seconds to MM:SS
    const formatDuration = (totalSeconds) => {
        if (!totalSeconds || isNaN(totalSeconds)) return "00:00";

        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);

        const pad = (num) => (num < 10 ? `0${num}` : num);

        if (hrs > 0) {
            return `${hrs}:${pad(mins)}:${pad(secs)}`;
        }
        return `${pad(mins)}:${pad(secs)}`;
    };

    const getCallIcon = (type) => {
      switch (type) {
          case 'Incoming':
              return { name: "arrow-back-circle-outline", color: "#3498db"  }; 
          case 'Outgoing':
              return { name: "arrow-forward-circle-outline", color: "#2ecc71" };
          default:
              return { name: "call-outline", color: "white" };
      }
    };
    const callIcon = getCallIcon(item.metadata?.type);
    return (
        <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
        <View style={styles.SearchResultItem}>
            <TouchableOpacity onPress={() => toggleExpand(item.recording?.name)}>
            <Ionicons 
                name={expandedId === item.recording?.name ? "chevron-down" : "chevron-forward"} 
                size={25} 
                color="white"
            />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.Results, {textAlign: 'left'}]}>{item.metadata?.caller_name || 'Unknown'}</Text>
            <Text style={styles.ResultsInfo}>
                {/* Using the new Hebrew Date and Time strings */}
                {/* {item.metadata?.displayDate} • {item.metadata?.displayTime} • */}
                 {formatDuration(item.metadata?.realDuration)}
            </Text>
            </View>

            <TouchableOpacity onPress={() => toggleFavorite(item.recording?.name)}>
            <Ionicons 
                name={favorites.includes(item.recording?.name) ? "star" : "star-outline"} 
                size={25} 
                color="white"
            />
            </TouchableOpacity>
        </View>
        
          {expandedId === item.recording?.name && (
            <View style={styles.expandedResult}>
              <Text style={styles.expandedResultsInfo}>Phone: {item.metadata?.number}</Text>
              <Text style={styles.expandedResultsInfo}>Date: {item.metadata?.date}</Text>
              <View style={{ flexDirection: 'row',}}>
                <Text style={[styles.expandedResultsInfo,]}>Type: {item.metadata?.type } 
                </Text>
                <Ionicons name={callIcon.name} size={22} color={callIcon.color} style={{ marginLeft: 5 }} />
              </View>
              <Text style={styles.expandedResultsInfo}>Name: {item.metadata.visibleName}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.renameActionButton} 
                    onPress={() => openRenameModal(item)}
                >
                  <Ionicons name="pencil-outline" size={20} color="white" />
                  <Text style={styles.actionLabel}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteActionButton}
                  onPress={() => deleteRecord(item)}
                >
                  <Ionicons name="trash-outline" size={20} color="white" />
                  <Text style={styles.actionLabel}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
        )}
        </TouchableOpacity>
    );
            }}
        />
      </View>
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.menuModal} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.sideMenu}>
            {/* User Info Section */}
            <View style={styles.userInfoSection}>
              <Ionicons name="person-circle-outline" size={60} color="#2D5C5C" />
              <Text style={styles.userName}>{userName}</Text> 
            </View>

            <View style={styles.menuDivider} />

            {/* Logout Button */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={25} color="#e74c3c" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
            {/* Delete Account Button */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={25} color="#e74c3c" />
              <Text style={styles.logoutText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.editModal}>
          <View style={styles.renameContainer}>
            <Text style={styles.modalTitle}>Rename Record</Text>
            <TextInput
              style={styles.renameInput}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter new name"
              placeholderTextColor="#aaa"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelBtn]} 
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveBtn]} 
                onPress={() => {
                  renameRecord(selectedRecord.recording.name, newDisplayName);
                  setRenameModalVisible(false);
                }}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    width: '100%'
  },
  title: {
    fontSize: 32,
    fontFamily: "Bitter-Regular", // Ensure font is loaded in App.js
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
  icon: {
    width: 39,
    height: 39,
    marginBottom: 10,
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
    height: 50
  },
  searchIcon: {
    width: 20,
    height: 20,
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
  // expandedResult: {
  //   backgroundColor: "#6C9E9E",
  //   padding: 15,
  //   width: "90%",
  //   borderRadius: 20,
  //   alignSelf: "center",
  //   marginTop: -25, // Overlap effect
  //   marginBottom: 15,
  //   zIndex: -1
  // },
  Results: {
    fontSize: 16,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
    fontWeight: 'bold'
  },
  ResultsInfo: {
    fontSize: 12,
    fontFamily: "Bitter-Regular",
    color: "#e0e0e0",
  },
  expandedResultsInfo: {
    fontSize: 14,
    fontFamily: "Bitter-Regular",
    color: "#ffffff",
    marginBottom: 5
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2D5C5C"
  },
  activeTab: {
    backgroundColor: "#2D5C5C",
  },
  tabText: {
    fontSize: 16,
    fontFamily: "Bitter-Regular",
    color: "#2D5C5C",
  },
  activeTabText: {
    color: "#ffffff",
  },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  // buttonText: {
  //   position: "absolute",
  //   right: 20,
  //   top: "50%",
  //   transform: [{ translateY: -17 }],
  // },
  menu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    paddingHorizontal: 20
  },
  menuButton: {
    position: "absolute",
    right: 20,
    top: 10,
  },
  menuModal: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  sideMenu: {
    width: '65%',
    height: '50%',
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    elevation: 5,
  },
  userInfoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  userName: {
    fontSize: 18,
    fontFamily: "Bitter-Regular",
    marginTop: 10,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  logoutText: {
    fontSize: 18,
    marginLeft: 15,
    color: '#e74c3c',
    fontFamily: "Bitter-Regular",
  },
  expandedResult: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    padding: 15,
    paddingTop: 30,
    marginTop: -40, // Pulls it up to connect with the record box
    width: '90%',
    alignSelf: 'center',
    marginBottom: 15,
    zIndex: -1
  },
    // expandedResult: {
  //   backgroundColor: "#6C9E9E",
  //   padding: 15,
  //   width: "90%",
  //   borderRadius: 20,
  //   alignSelf: "center",
  //   marginTop: -25, // Overlap effect
  //   marginBottom: 15,
  //   zIndex: -1
  // },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  renameActionButton: {
    flexDirection: 'row',
    backgroundColor: '#2D5C5C',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteActionButton: {
    flexDirection: 'row',
    backgroundColor: '#c0392b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionLabel: {
    color: 'white',
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 14,
  },
  editModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameContainer: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Bitter-Regular",
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  renameInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#2D5C5C',
    fontSize: 18,
    paddingVertical: 8,
    color: '#333',
    marginBottom: 30,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: '#95a5a6' },
  saveBtn: { backgroundColor: '#2D5C5C' },
  buttonText: { color: 'white', fontWeight: 'bold' },
});
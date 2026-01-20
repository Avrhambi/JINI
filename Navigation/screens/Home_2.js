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


export default function HomeScreen() {
  const [KeyWord, setKeyWord] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [currentTab, setCurrentTab] = useState("all");
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = React.useState('Guest');
  const [isRenameModalVisible, setRenameModalVisible] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);
  const [newDisplayName, setNewDisplayName] = React.useState("");
  const BASE_URL = 'http://172.18.124.55:8000';

  
  const navigation = useNavigation();
  const { CallLogModule } = NativeModules; // Ensure this Native Module exists in your android folder


  // const requestFolderPermission = async () => {
  //   const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  //   if (permissions.granted) {
  //     const directoryUri = permissions.directoryUri;
  //     await AsyncStorage.setItem('recordingFolderUri', directoryUri);
  //     return directoryUri;
  //   }
  //   Alert.alert("Permission Required", "Please select the PhoneRecords folder to see recordings.");
  //   return null;
  // };

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


  // const loadRecords = async () => {
  //   try {
  //     console.log("Loading records...");
      
  //     // 1. Get System Call Logs
  //     // Ensure you have permission granted in AndroidManifest and requested in app
  //     const logs = await CallLogModule.getCallLogs(); 

  //     // 2. Get Local Audio Files from your App's folder
  //     const fileNames = await FileSystem.readDirectoryAsync(audioDir);
      
  //     // Get detailed info for files to check timestamps/size
  //     const fileDetails = await Promise.all(
  //       fileNames.map(async (name) => {
  //         const info = await FileSystem.getInfoAsync(audioDir + name);
  //         return {
  //           name: name,
  //           uri: info.uri,
  //           size: info.size,
  //           // modificationTime is usually in seconds on Expo, CallLog is in ms
  //           modificationTime: info.modificationTime * 1000 
  //         };
  //       })
  //     );

  //     // 3. Match Logic
  //     // We iterate through the Logs and try to find a matching audio file.
  //     // Since manual sharing might change the file time slightly, we use a "Threshold".
  //     const TIME_THRESHOLD_MS = 60 * 1000 * 5; // 5 Minutes buffer

  //     const mergedRecords = logs.map(log => {
  //       const logDate = parseInt(log.date); // Call Start Time
  //       const logDurationMs = parseInt(log.duration) * 1000;
  //       const logEndTime = logDate + logDurationMs;

  //       const getCallTypeLabel = (type) => {
  //           switch (type) {
  //           case '1': return 'Incoming';
  //           case '2': return 'Outgoing';
  //           case '3': return 'Missed';
  //           default: return 'Call';
  //           }
  //       };

  //       // Find a file that was modified/created around the time of the call
  //       // OR (Optional) You could match by checking if filename contains the phone number
  //       const match = fileDetails.find(file => {
  //           // Check 1: Time match (File created within 5 mins of call start or end)
  //           const timeDiff = Math.abs(file.modificationTime - logDate);
  //           const timeDiffEnd = Math.abs(file.modificationTime - logEndTime);
            
  //           // Check 2: Filename match (If file contains phone number)
  //           const numberMatch = file.name.includes(log.number);

  //           return (timeDiff < TIME_THRESHOLD_MS || timeDiffEnd < TIME_THRESHOLD_MS) || numberMatch;
  //       });

  //       if (!match) return null; // If no recording found, return null

  //       return {
  //         ...log,
  //         recording: match, // Attach the file object
  //         metadata: {
  //           name: log.name && log.name !== 'null' ? log.name : 'Unknown',
  //           number: log.number,
  //           type: getCallTypeLabel(log.type), // Uses the helper above
  //           duration: log.duration,
  //           date: new Date(logDate).toLocaleString(),
  //           }
  //       };
  //     }).filter(Boolean); // Remove logs that have no recording

  //     console.log(`Found ${mergedRecords.length} logs with recordings.`);
  //     setRecords(mergedRecords);

  //   } catch (error) {
  //     console.error('Error loading records:', error);
  //     Alert.alert('Error', 'Failed to load records. Check permissions.');
  //   }
  // };


    // const loadRecords = async () => {
    // try {
    //     console.log("Loading records...");

    //     // 1. Get System Call Logs
    //     const logs = await NativeModules.CallLogModule.getCallLogs();

    //     // 2. Get Local Audio Files from your App's folder
    //     const fileNames = await FileSystem.readDirectoryAsync(audioDir);

    //     // Get detailed info and extract timestamps from filenames
    //     const fileDetails = await Promise.all(
    //     fileNames.map(async (name) => {
    //         const info = await FileSystem.getInfoAsync(audioDir + name);
            
    //         // Extract 13-digit timestamp from filename (e.g., 1735467960000)
    //         const timestampMatch = name.match(/\d{13}/);
    //         const fileTimestamp = timestampMatch ? parseInt(timestampMatch[0]) : null;

    //         return {
    //         name: name,
    //         uri: info.uri,
    //         size: info.size,
    //         fileTimestamp: fileTimestamp,
    //         // Fallback to system modification time if no timestamp in name
    //         modificationTime: info.modificationTime ? info.modificationTime * 1000 : null
    //         };
    //     })
    //     );

    //     // 3. Match Logic
    //     const TIME_THRESHOLD_MS = 30 * 1000; // 30 Seconds buffer for exact matching

    //     const mergedRecords = logs.map(log => {
    //     const logDate = parseInt(log.date); // Call Start Time in ms
    //     const logDurationMs = parseInt(log.duration) * 1000;
    //     const logEndTime = logDate + logDurationMs;

    //     const getCallTypeLabel = (type) => {
    //         switch (type) {
    //         case '1': return 'Incoming';
    //         case '2': return 'Outgoing';
    //         case '3': return 'Missed';
    //         default: return 'Call';
    //         }
    //     };

    //     const match = fileDetails.find(file => {
    //         // 1. Check if the filename timestamp is an EXACT match (within 10 seconds)
    //         if (file.fileTimestamp) {
    //             return Math.abs(file.fileTimestamp - logDate) < 10000; 
    //         }

    //         // 2. If no exact timestamp match, check number + small window (only for manual imports)
    //         const cleanLogNumber = log.number.replace(/\D/g, '');
    //         const numberMatch = cleanLogNumber.length > 5 && file.name.includes(cleanLogNumber);
    //         const isModifiedVeryRecent = Math.abs(file.modificationTime - logDate) < 60000; // 1 min

    //         return numberMatch && isModifiedVeryRecent;
    //     });

    //     if (!match) return null;

    //     const dateObj = new Date(logDate);

    //     return {
    //         ...log,
    //         recording: match,
    //         metadata: {
    //         name: log.name && log.name !== 'null' ? log.name : 'Unknown',
    //         number: log.number,
    //         type: getCallTypeLabel(log.type),
    //         duration: log.duration,
    //         // Format for Israel: 29/12/25, 12:26
    //         displayDate: dateObj.toLocaleDateString('he-IL', {
    //             day: '2-digit',
    //             month: '2-digit',
    //             year: '2-digit',
    //         }),
    //         displayTime: dateObj.toLocaleTimeString('he-IL', {
    //             hour: '2-digit',
    //             minute: '2-digit',
    //         }),
    //         fullDateTime: dateObj.toLocaleString('he-IL'),
    //         }
    //     };
    //     }).filter(Boolean);

    //     console.log(`Found ${mergedRecords.length} logs with recordings.`);
    //     setRecords(mergedRecords);

    // } catch (error) {
    //     console.error('Error loading records:', error);
    //     Alert.alert('Error', 'Failed to load records.');
    // }
    // };


  // Reload records whenever screen focuses (in case user added a file)


  const loadRecords = async () => {
  try {
    console.log("Loading records...");

    // 1. Get System Call Logs
    const logs = await NativeModules.CallLogModule.getCallLogs();

    // 2. Get Local Audio Files from your App's folder
    const fileNames = await FileSystem.readDirectoryAsync(audioDir);

    // Get detailed info and extract timestamps from filenames
    const fileDetails = await Promise.all(
      fileNames.map(async (name) => {
        const info = await FileSystem.getInfoAsync(audioDir + name);
        
        // Extract 13-digit timestamp from filename (e.g., 1735467960000)
        const timestampMatch = name.match(/\d{13}/);
        const fileTimestamp = timestampMatch ? parseInt(timestampMatch[0]) : null;

        let actualDuration = 0;
          try {
            const { sound } = await Audio.Sound.createAsync({ uri: info.uri });
            const status = await sound.getStatusAsync();
            actualDuration = status.durationMillis / 1000; // Convert to seconds
            await sound.unloadAsync(); // Important: Free up memory!
          } catch (e) {
            console.log("Could not get duration for", name);
          }

        return {
          name: name,
          uri: info.uri,
          size: info.size,
          fileTimestamp: fileTimestamp,
          // Fallback to system modification time if no timestamp in name
          modificationTime: info.modificationTime ? info.modificationTime * 1000 : null,
          actualDuration: actualDuration  
        };
      })
    );

    // 3. Match Logic
    const TIME_THRESHOLD_MS = 30 * 1000; // 30 Seconds buffer for exact matching

    const mergedRecords = logs.map(log => {
      const logDate = parseInt(log.date); // Call Start Time in ms

      const getCallTypeLabel = (type) => {
        switch (type) {
          case '1': return 'Incoming';
          case '2': return 'Outgoing';
          case '3': return 'Missed';
          default: return 'Call';
        }
      };

    const match = fileDetails.find(file => {
        // 1. Check if the filename timestamp is an EXACT match (within 10 seconds)
        if (file.fileTimestamp) {
            return Math.abs(file.fileTimestamp - logDate) < 10000; 
        }

        // 2. If no exact timestamp match, check number + small window (only for manual imports)
        const cleanLogNumber = log.number.replace(/\D/g, '');
        const numberMatch = cleanLogNumber.length > 5 && file.name.includes(cleanLogNumber);
        const isModifiedVeryRecent = Math.abs(file.modificationTime - logDate) < 60000; // 1 min

        return numberMatch && isModifiedVeryRecent;
    });

      if (!match) return null;

      const dateObj = new Date(logDate);

      return {
        ...log,
        recording: match,
        metadata: {
          // This is the name shown in the list. 
          // It prioritizes the User-Given Alias over the Original Filename.
          visibleName: log.alias && log.alias !== 'null' ? log.alias : match.name,
          
          // Keep the original name in metadata just in case you need it
          originalFileName: match.name, 

          name: log.name && log.name !== 'null' ? log.name : 'Unknown',
          number: log.number,
          type: getCallTypeLabel(log.type),
          realDuration: match.actualDuration, 
          displayDate: dateObj.toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          }),
          displayTime: dateObj.toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          fullDateTime: dateObj.toLocaleString('he-IL'),
        }
      };
    }).filter(Boolean);

    console.log(`Found ${mergedRecords.length} logs with recordings.`);
    setRecords(mergedRecords);

  } catch (error) {
    console.error('Error loading records:', error);
    Alert.alert('Error', 'Failed to load records.');
  }
};



    useFocusEffect(
        useCallback(() => {
            const init = async () => {
            // 1. Check/Request permissions first
            const hasPermissions = await requestAppPermissions();
            
            // 2. Only attempt to load logs if we have permission
            if (hasPermissions) {
                loadRecords();
            } else {
                // Optional: Alert the user if they haven't granted permissions yet
                console.log("Permissions not granted yet.");
            }
            };

            init();
        }, [])
    );




  // AUTOMATED REFRESH: Runs whenever you open the screen
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  // const search_key_word = async () => {
  //   // Use the address for Android Emulator as per your example
  //   const BASE_URL = 'http://10.0.2.2:8000';
    
  //   if (!KeyWord.trim()) {
  //     // If search is empty, reload original records
  //     loadRecords();
  //     return;
  //   }

  //   setRefreshing(true);

  //   const timeout = (ms) =>
  //     new Promise((_, reject) =>
  //       setTimeout(() => reject(new Error("Request timed out")), ms)
  //     );

  //   try {
  //     const responsePromise = fetch(`${BASE_URL}/records/search`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ keyword: KeyWord })
  //     });

  //     const response = await Promise.race([responsePromise, timeout(10000)]);

  //     if (!response.ok) {
  //       throw new Error("Search failed on server");
  //     }

  //     const searchData = await response.json(); 
  //     /* Expected searchData format: 
  //       [ { "filename": "rec_123.mp3", "timestamps": [12.5, 45.0, 110.2] }, ... ]
  //     */

  //     // Filter our local records state to only show those found by the backend
  //     const filteredResults = records.map(record => {
  //       const serverMatch = searchData.find(s => s.filename === record.recording.name);
        
  //       if (serverMatch) {
  //         return {
  //           ...record,
  //           foundTimestamps: serverMatch.timestamps // Attach timestamps for Listen.js
  //         };
  //       }
  //       return null;
  //     }).filter(Boolean);

  //     setRecords(filteredResults);

  //   } catch (error) {
  //     console.log("Search error:", error.message);
  //     Alert.alert("Search Error", error.message === "Request timed out" 
  //       ? "Server took too long" 
  //       : "Failed to fetch search results.");
  //   } finally {
  //     setRefreshing(false);
  //   }
  // };

  // ---------------------------------------------------------
  // File Handling (Manual Pick)
  // ---------------------------------------------------------
  
  const search_key_word = async () => {
  if (!KeyWord.trim()) {
    loadRecords();
    return;
  }

  setRefreshing(true);

  // --- MOCK BACKEND SIMULATION ---
  // Simulate a 1-second delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // This is exactly what your backend SHOULD return
  const mockSearchData = [
    {
      "filename": records[0]?.recording?.name || "example.mp3", 
      "timestamps": [1, 2, 3.1, 6.2, 9.2, 10.5] // Seconds where keyword was found
    },
    {
      "filename": records[1]?.recording?.name || "sample.mp3",
      "timestamps": [1.0,2, 5.0, 6.5, 7]
    }
  ];

  // Process the results just like the real fetch would
  const filteredResults = records.map(record => {
    const serverMatch = mockSearchData.find(s => s.filename === record.recording.name);
    
    if (serverMatch) {
      return {
        ...record,
        foundTimestamps: serverMatch.timestamps // This passes to Listen screen
      };
    }
    return null;
  }).filter(Boolean);

  setRecords(filteredResults);
  setRefreshing(false);
  
  if (filteredResults.length > 0) {
    Alert.alert("Mock Success", `Found keyword at ${filteredResults[0].foundTimestamps.length} positions`);
  }
};
  
  // const pickAudio = async () => {
  //   try {
  //     const result = await DocumentPicker.getDocumentAsync({
  //       type: "audio/*",
  //       copyToCacheDirectory: true,
  //     });

  //     if (result.canceled) return;

  //     const file = result.assets[0];
  //     const destPath = audioDir + file.name;

  //     // Save to local folder
  //     await FileSystem.copyAsync({
  //       from: file.uri,
  //       to: destPath,
  //     });

  //     Alert.alert("Imported", "File saved. Refreshing list...");
      
  //     // Upload logic here if needed...

  //     // Reload list to try and match this new file to a log
  //     loadRecords();

  //   } catch (err) {
  //     console.error("Error picking document:", err);
  //     Alert.alert("Error", `Failed to pick file: ${err.message}`);
  //   }
  // };

  // ---------------------------------------------------------
  // UI Helpers
  // ---------------------------------------------------------
 
 const pickAudio = async () => {
    try {
      // 1. Pick the file
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      // 2. Save to local app folder (PhoneRecords)
      const destPath = audioDir + file.name;
      await FileSystem.copyAsync({
        from: file.uri,
        to: destPath,
      });

      Alert.alert("Processing", "Uploading to server for transcription...");

      // 3. Prepare Upload Data
      const token = await AsyncStorage.getItem('access_token'); // Get auth token
      const formData = new FormData();

      // Append file
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'audio/mpeg', // Fallback type
      });

      // Append Metadata (matches your backend's expected fields)
      // Note: Since this is a manual import, we might not have a call log match yet,
      // so we send basic info or placeholder data.
      formData.append('metadata', JSON.stringify({
        filename: file.name,
        uploadDate: new Date().toISOString(),
        source: 'manual_import'
      }));

      // 4. Upload to Backend
      const BASE_URL = 'http://172.18.124.55:8000';
      
      const response = await fetch(`${BASE_URL}/upload-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data', 
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const serverResponse = await response.json();
      
      // Expected serverResponse format: 
      // { "transcription": "Hello world...", "timestamps": [2.5, 10.1], "status": "success" }

      console.log("Upload Success:", serverResponse);

      // 5. Save Transcription & Timestamps Locally
      // We use the filename as the unique key to retrieve this later in Listen.js
      const storageKey = `transcription_${file.name}`;
      const dataToSave = {
        transcription: serverResponse.transcription,
        lastUpdated: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

      Alert.alert("Success", "File uploaded and transcribed!");

      // 6. Reload list to show the new file
      loadRecords();

    } catch (err) {
      console.error("Error processing file:", err);
      Alert.alert("Error", `Failed to process file: ${err.message}`);
    }
  };
 
  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  React.useEffect(() => {
  const getUserName = async () => {
    try {
      const name = await AsyncStorage.getItem('user_name');
      if (name) setUserName(name);
    } catch (e) {
      console.log("Failed to load user name");
    }
  };

  getUserName();
}, []);

const handleLogout = async () => {
  try {
    setMenuVisible(false);
    
    // Clear tokens and the name
    await AsyncStorage.multiRemove(['user_name', 'access_token', 'refresh_token']);

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  } catch (error) {
    console.error("Logout error:", error);
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
            const token = await AsyncStorage.getItem('user_token');
            const response = await fetch(`${BASE_URL}/auth/delete-account`, {
              method: 'DELETE',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
              },
            });

            if (response.ok) {
              // Cleanup local storage
              await AsyncStorage.multiRemove(['user_token', 'user_name', 'refresh_token']);
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
const renameRecord = async (recordId, newName) => {
  try {
    const response = await fetch(`${BASE_URL}/records/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, new_display_name: newName })
    });

    if (response.ok) {
      // Update UI locally without reloading everything
      setRecords(prev => prev.map(r => 
        r.id === recordId ? { ...r, metadata: { ...r.metadata, visibleName: newName } } : r
      ));
    }
  } catch (error) {
    Alert.alert("Error", "Could not rename record.");
  }
};

// DELETE RECORD
const deleteRecord = async (record) => {
  Alert.alert("Delete", "Are you sure you want to delete this recording?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
        try {
          // 1. Delete from Database
          const dbResponse = await fetch(`${BASE_URL}/records/${record.id}`, { method: 'DELETE' });
          
          if (dbResponse.ok) {
            // 2. Delete from App Storage (FileSystem)
            await FileSystem.deleteAsync(record.recording.uri);
            
            // 3. Update UI
            setRecords(prev => prev.filter(r => r.id !== record.id));
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
            const matchesSearch = r.metadata?.name?.toLowerCase().includes(KeyWord.toLowerCase()) ||
                                  r.metadata?.number?.includes(KeyWord);
            const matchesTab = currentTab === "all" || 
                              (currentTab === "favorites" && favorites.includes(r.recording?.name));
            return matchesTab && matchesSearch;
          })}
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
              return { name: "arrow-back-circle-outline", color: "#3498db"  }; // Green for Incoming
          case 'Outgoing':
              return { name: "arrow-forward-circle-outline", color: "#2ecc71" }; // Blue for Outgoing
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
            <Text style={[styles.Results, {textAlign: 'left'}]}>{item.metadata?.name || 'Unknown'}</Text>
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
              <Text style={styles.expandedResultsInfo}>Date: {item.metadata?.fullDateTime}</Text>
              <View style={{ flexDirection: 'row',}}>
                <Text style={[styles.expandedResultsInfo,]}>Type: {item.metadata?.type } 
                </Text>
                <Ionicons name={callIcon.name} size={22} color={callIcon.color} style={{ marginLeft: 5 }} />
              </View>
              <Text style={styles.expandedResultsInfo}>Name: {item.recording.name}</Text>
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
                  renameRecord(selectedRecord.id, newDisplayName);
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
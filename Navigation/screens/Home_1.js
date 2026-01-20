import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, FlatList, Alert, NativeModules } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as FileSystem  from "expo-file-system";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from "expo-document-picker";
import { requestAppPermissions } from "../../utils/permissions"; 
import { formatFileSize } from "../../utils/recordingUtils";

export default function HomeScreen() {
  const [KeyWord, setKeyWord] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [currentTab, setCurrentTab] = useState("all");
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const navigation = useNavigation();
  const { CallLogModule } = NativeModules;

  // Path to the app's private internal storage
  const audioDir = FileSystem.documentDirectory + "PhoneRecords/";

  // Ensure internal folder exists on mount
  useEffect(() => {
    (async () => {
      const folderInfo = await FileSystem.getInfoAsync(audioDir);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      }
    })();
  }, []);

  // CORE LOGIC: Load from Internal Private Folder
const loadRecords = async () => {
  setRefreshing(true);
  try {
    console.log("Starting Load Process...");

    // 1. Get Logs
    const logs = await NativeModules.CallLogModule.getCallLogs();

    // 2. Get Local Files
    const fileNames = await FileSystem.readDirectoryAsync(audioDir);
    const fileDetails = await Promise.all(
      fileNames.map(async (name) => {
        const info = await FileSystem.getInfoAsync(audioDir + name);
        const timestampMatch = name.match(/\d{13}/);
        return {
          name,
          uri: info.uri,
          size: info.size,
          fileTimestamp: timestampMatch ? parseInt(timestampMatch[0]) : null,
          modificationTime: info.modificationTime ? info.modificationTime * 1000 : null,
        };
      })
    );

    // 3. Match Logic
    const mergedRecords = logs.map((log) => {
      const logDate = parseInt(log.date);
      const cleanLogNumber = log.number.replace(/\D/g, "");

      // Find candidates with a wider, more forgiving window (10 minutes)
      const candidates = fileDetails.filter((file) => {
        const fileTime = file.fileTimestamp || file.modificationTime;
        const timeDiff = Math.abs(fileTime - logDate);

        // MATCH CRITERIA:
        // A) Phone number is in the filename
        const numberMatch = cleanLogNumber.length > 5 && file.name.includes(cleanLogNumber);
        // B) OR the file was created within 10 minutes of the call
        const timeMatch = timeDiff < 600000; 

        return numberMatch || timeMatch;
      });

      if (candidates.length === 0) return null;

      // From the candidates, pick the one closest to the call time
      const bestMatch = candidates.reduce((prev, curr) => {
        const prevTime = prev.fileTimestamp || prev.modificationTime;
        const currTime = curr.fileTimestamp || curr.modificationTime;
        return Math.abs(currTime - logDate) < Math.abs(prevTime - logDate) ? curr : prev;
      });

      const dateObj = new Date(logDate);
      return {
        ...log,
        recording: bestMatch,
        metadata: {
          name: log.name && log.name !== "null" ? log.name : "Unknown",
          number: log.number,
          type: log.type === "1" ? "Incoming" : log.type === "2" ? "Outgoing" : "Missed",
          duration: log.duration,
          displayDate: dateObj.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }),
          displayTime: dateObj.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
          fullDateTime: dateObj.toLocaleString("he-IL"),
        },
      };
    }).filter(Boolean);

    // 4. Remove Duplicates (Ensure one file isn't used for two logs)
    // We keep only the log that is closest to the file
    const uniqueRecords = [];
    const usedFiles = new Set();

    // Sort by closest time difference first to give priority to the best matches
    const sortedByPrecision = mergedRecords.sort((a, b) => {
        const diffA = Math.abs((a.recording.fileTimestamp || a.recording.modificationTime) - parseInt(a.date));
        const diffB = Math.abs((b.recording.fileTimestamp || b.recording.modificationTime) - parseInt(b.date));
        return diffA - diffB;
    });

    sortedByPrecision.forEach(record => {
        if (!usedFiles.has(record.recording.name)) {
            uniqueRecords.push(record);
            usedFiles.add(record.recording.name);
        }
    });

    // Re-sort by date for the UI
    setRecords(uniqueRecords.sort((a, b) => parseInt(b.date) - parseInt(a.date)));

  } catch (error) {
    console.error("Match Logic Error:", error);
    Alert.alert("Error", "Failed to process recordings.");
  } finally {
    setRefreshing(false);
  }
};

  // Only reloads when the screen actually focuses
  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const hasPermissions = await requestAppPermissions();
        if (hasPermissions) {
          loadRecords();
        }
      };
      init();
    }, [])
  );

  // Manual Import via Plus Button
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const destPath = audioDir + file.name;

      // Copy from Downloads/Cache into the App's Private Folder
      await FileSystem.copyAsync({
        from: file.uri,
        to: destPath,
      });

      Alert.alert("Success", "File imported to app storage.");
      loadRecords(); // Refresh list after import

    } catch (err) {
      console.error("Error picking document:", err);
      Alert.alert("Error", "Failed to import file.");
    }
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDuration = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <LinearGradient colors={["#E1E6E7", "#ADC3C7", "#424242"]} locations={[0.25, 0.63, 1]} style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.menu}>
          <View style={styles.logo}>
            <Text style={styles.title}>JINI</Text>
            <Image source={require("../../assets/genie-512.png")} style={styles.icon} resizeMode="center" />
          </View>
          <TouchableOpacity style={styles.buttonText} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in-outline" size={35} color="black" />
          </TouchableOpacity>
        </View>

        <View style={styles.SearchBar}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search" 
            placeholderTextColor="#ffffff" 
            value={KeyWord} 
            onChangeText={setKeyWord} 
          />
          <Image source={require("../../assets/magnifying-glass.png")} style={styles.searchIcon} resizeMode="center" />
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignItems: 'center'}}>
            <Text style={styles.headLine}>My Records</Text>
            <TouchableOpacity onPress={pickAudio} style={{padding: 5}}>
                <Ionicons name="add-circle-outline" size={30} color="#2D5C5C" />
            </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabButton, currentTab === "all" && styles.activeTab]} onPress={() => setCurrentTab("all")}>
            <Text style={[styles.tabText, currentTab === "all" && styles.activeTabText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, currentTab === "favorites" && styles.activeTab]} onPress={() => setCurrentTab("favorites")}>
            <Text style={[styles.tabText, currentTab === "favorites" && styles.activeTabText]}>Favorites</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={records.filter(r => {
            const matchesSearch = r.metadata?.name?.toLowerCase().includes(KeyWord.toLowerCase()) || r.metadata?.number?.includes(KeyWord);
            const matchesTab = currentTab === "all" || (currentTab === "favorites" && favorites.includes(r.recording?.name));
            return matchesTab && matchesSearch;
          })}
          keyExtractor={(item) => `${item.date}-${item.recording.name}`}
          refreshing={refreshing}
          onRefresh={loadRecords}
          contentContainerStyle={{ paddingBottom: 40, width: "100%" }}
          ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#555'}}>No records imported yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
              <View style={styles.SearchResultItem}>
                <TouchableOpacity onPress={() => toggleExpand(item.recording?.name)}>
                  <Ionicons name={expandedId === item.recording?.name ? "chevron-down" : "chevron-forward"} size={25} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.Results}>{item.metadata?.name || 'Unknown'}</Text>
                  <Text style={styles.ResultsInfo}>
                    {item.metadata?.displayDate} • {item.metadata?.displayTime} • {formatDuration(item.metadata?.duration)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => toggleFavorite(item.recording?.name)}>
                  <Ionicons name={favorites.includes(item.recording?.name) ? "star" : "star-outline"} size={25} color="white" />
                </TouchableOpacity>
              </View>
              {expandedId === item.recording?.name && (
                <View style={styles.expandedResult}>
                  <Text style={styles.expandedResultsInfo}>Phone: {item.metadata?.number}</Text>
                  <Text style={styles.expandedResultsInfo}>Type: {item.metadata?.type}</Text>
                  <Text style={styles.expandedResultsInfo}>Full Date: {item.metadata?.fullDateTime}</Text>
                  <Text style={styles.expandedResultsInfo}>File: {item.recording.name}</Text>
                  <Text style={styles.expandedResultsInfo}>Size: {formatFileSize(item.recording.size)}</Text>
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
  container: { flex: 1, backgroundColor: "transparent" },
  topSection: { flex: 1, justifyContent: "flex-start", alignItems: "center", paddingTop: 40, width: '100%' },
  title: { fontSize: 32, fontFamily: "Bitter-Regular", color: "#000", marginTop: 10 },
  headLine: { fontSize: 32, fontFamily: "Bitter-Regular", color: "#000", marginTop: 10, marginBottom: 10 },
  icon: { width: 39, height: 39, marginBottom: 10 },
  logo: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  SearchBar: { backgroundColor: "#2D5C5C", flexDirection: "row", alignItems: "center", borderRadius: 20, justifyContent: "space-between", width: "80%", marginBottom: 20, marginTop: 20, paddingHorizontal: 20, height: 50 },
  searchIcon: { width: 20, height: 20 },
  searchInput: { flex: 1, fontSize: 18, fontFamily: "Bitter-Regular", color: "#ffffff" },
  SearchResultItem: { backgroundColor: "#2D5C5C", paddingVertical: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", borderRadius: 20, justifyContent: "space-between", width: "90%", alignSelf: "center", marginBottom: 20 },
  expandedResult: { backgroundColor: "#6C9E9E", padding: 15, width: "90%", borderRadius: 20, alignSelf: "center", marginTop: -25, marginBottom: 15, zIndex: -1 },
  Results: { fontSize: 16, fontFamily: "Bitter-Regular", color: "#ffffff", fontWeight: 'bold' },
  ResultsInfo: { fontSize: 12, fontFamily: "Bitter-Regular", color: "#e0e0e0" },
  expandedResultsInfo: { fontSize: 14, fontFamily: "Bitter-Regular", color: "#ffffff", marginBottom: 5 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 20, marginHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 1, borderColor: "#2D5C5C" },
  activeTab: { backgroundColor: "#2D5C5C" },
  tabText: { fontSize: 16, fontFamily: "Bitter-Regular", color: "#2D5C5C" },
  activeTabText: { color: "#ffffff" },
  tabs: { flexDirection: "row", justifyContent: "space-between", width: "80%", marginBottom: 20 },
  buttonText: { position: "absolute", right: 20, top: "50%", transform: [{ translateY: -17 }] },
  menu: { flexDirection: "row", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", paddingHorizontal: 20 },
});
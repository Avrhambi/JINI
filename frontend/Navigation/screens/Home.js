import React, { useEffect, useState, useCallback, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Modal, Alert, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Services & Utils
import { 
    ensureDirectory,
    loadLocalRecords,
    searchRecords, 
    updateFavoriteStatus, 
    renameRecord, 
    deleteRecord, 
    deleteAccount, 
    uploadAudioFile } from "../../services/HomeServices";
import { requestAppPermissions } from "../../utils/permissions";
import { getUserInfo, removeUserCredentials, getGoogleLoginStatus } from "../../utils/auth";
import { AuthContext } from "../../utils/AuthContext";

export default function HomeScreen() {
    const [KeyWord, setKeyWord] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [currentTab, setCurrentTab] = useState("all");
    const [records, setRecords] = useState([]);
    const [allRecords, setAllRecords] = useState([]);
    const [userName, setUserName] = useState('Guest');
    const [isRenameModalVisible, setRenameModalVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [newDisplayName, setNewDisplayName] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const navigation = useNavigation();
    const { signOut } = useContext(AuthContext);

    const initRecords = async () => {
        const data = await loadLocalRecords(setFavorites);
        setRecords(data);
        setAllRecords(data);
    };

    useEffect(() => {
        ensureDirectory();
        getUserInfo().then(info => info?.name && setUserName(info.name));
        requestAppPermissions().then(has => has && initRecords());
    }, [])
  

    useFocusEffect(
      useCallback(() => {
        const refreshData = async () => {
          const data = await loadLocalRecords(setFavorites);
          setAllRecords(data);
          if (submittedQuery === "") {
              setRecords(data);
          }
        };
        refreshData();
      }, [submittedQuery]) 
    );

    // Search Handler
    const handleSearch = async () => {
      if (!KeyWord.trim()) {
        setRecords(allRecords);
        setSubmittedQuery(KeyWord);
        return;
      }

      setStatusMessage("Searching records...");
      setIsLoading(true);
      
      try {
        const results = await searchRecords(KeyWord, allRecords);
        setRecords(results.length > 0 ? results : allRecords);
        setSubmittedQuery(KeyWord);
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Delete Record Handler
    const handleDelete = (record) => {
        Alert.alert("Delete", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            const success = await deleteRecord(record);
            if (success) {                
                setRecords(prev => prev.filter(r => r.recording.name !== record.recording.name));
            }        
        }   
        }
        ]);
    };

    // Logout Handler
    const handleLogout = async () => {
      setMenuVisible(false);
      await signOut();      
    };

    // Rename Handler
    const handleRename = async () => {
      const success = await renameRecord(selectedRecord.recording.name, newDisplayName);
      if (success) {
        setRecords(prev => prev.map(r => 
        r.recording.name === selectedRecord.recording.name 
        ? { ...r, metadata: { ...r.metadata, visibleName: newDisplayName } } : r
        ));
        setRenameModalVisible(false);
      }
    };

    // Delete Account Handler
    const handleDeleteAccount = () => {
        Alert.alert(
        "Delete Account",
        "Are you sure? This will permanently delete all your records and account data.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", 
                style: "destructive", onPress: async () => { 
                  const success = await deleteAccount();
                  if (success) {
                      setRecords([]); // Clear records from UI
                      setAllRecords([]);
                      setFavorites([]);
                      setMenuVisible(false);
                      await signOut();
                  } else {
                  Alert.alert("Error", "Account deletion failed.");
                  }
                }
              }
            ]
        );
    };

    // Expand/Collapse Handler
    const toggleExpand = (id) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    // Favorite Toggle Handler
    const toggleFavorite = async (recordName) => {
      const updatedFavorites = await updateFavoriteStatus(recordName, favorites.includes(recordName), favorites);
      setFavorites(updatedFavorites);
    };

    // Audio Picker and Upload Handler
    const handlePickAudio = async () => {
      // 1. Open the UI Picker
      const result = await DocumentPicker.getDocumentAsync({ 
      type: "audio/*", 
      copyToCacheDirectory: true 
      });

      if (result.type === "cancel") return;
      const file = result.assets[0];
      setStatusMessage("Uploading and transcribing record...");
      setIsLoading(true);
      try {
        // 2. Call the service to handle processing and upload
        const success = await uploadAudioFile(file);

        if (success) {
          Alert.alert("Success", "Uploaded and transcribed!");
          initRecords(); // Refresh the list from local storage
          }
        } catch (error) {
          Alert.alert("Upload Error", error.message);
        }
        finally {
          setIsLoading(false);
        }
    };
        
    // Rename Modal Opener
    const openRenameModal = (record) => {
        setSelectedRecord(record);
        setNewDisplayName(record.metadata?.visibleName || "");
        setRenameModalVisible(true);
    }

    return (
        <LinearGradient colors={["#E1E6E7", "#ADC3C7", "#424242"]} locations={[0.25, 0.63, 1]} style={styles.container}>
          <View style={styles.topSection}>
            {/* Header */}
            <View style={styles.menu}>
            <View style={styles.logo}>
                <Text style={styles.title}>JINI</Text>
                <Image source={require("../../assets/genie-512.png")} style={styles.icon} resizeMode="center" />
            </View>
            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
                <Ionicons name="menu" size={35} color="black" />
            </TouchableOpacity>
            </View>

            {/* Search */}
            {/* <View style={styles.SearchBar}>
            <TextInput 
                style={styles.searchInput} 
                placeholder="Search" 
                placeholderTextColor="#ffffff" 
                value={KeyWord} 
                onChangeText={setKeyWord}
                onSubmitEditing={handleSearch}
            />
            <TouchableOpacity onPress={handleSearch}>
                <Image source={require("../../assets/magnifying-glass.png")} style={styles.searchIcon} resizeMode="center" />
            </TouchableOpacity>
            </View> */}
            <View style={styles.SearchBar}>
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search" 
                placeholderTextColor="#ffffff" 
                value={KeyWord} 
                onChangeText={(text) => {
                  setKeyWord(text);
                  if (text === "") {
                    setSubmittedQuery(""); 
                    setRecords(allRecords);
                  }
                }}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch}>
                <Image 
                  source={require("../../assets/magnifying-glass.png")} 
                  style={styles.searchIcon} 
                  resizeMode="center" 
                />
              </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignItems: 'center'}}>
              <Text style={styles.headLine}>My Records</Text>
              <TouchableOpacity onPress={handlePickAudio} style={{padding: 5}}>
                  <Ionicons name="add-circle-outline" size={30} color="#2D5C5C" />
              </TouchableOpacity>
            </View>
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
            {/* FlatList with RenderItem (item icons, favorite toggle, expanded view)  */}
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
            renderItem={({ item }) => {
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
                            onPress={() => handleDelete(item)}
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
            {/* Tabs */}

        </View>

        {/* Side Menu Modal */}
        <Modal visible={isMenuVisible} transparent animationType="fade">
            <TouchableOpacity style={styles.menuModal} onPress={() => setMenuVisible(false)}>
            <View style={styles.sideMenu}>
                <View style={styles.userInfoSection}>
                <Ionicons name="person-circle-outline" size={60} color="#2D5C5C" />
                <Text style={styles.userName}>{userName}</Text>
                </View>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={25} color="#e74c3c" />
                <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
                    <Ionicons name="trash-outline" size={25} color="#e74c3c" />
                    <Text style={styles.logoutText}>Delete Account</Text>
                </TouchableOpacity>
            </View>
            </TouchableOpacity>
        </Modal>
        {/* Rename Modal */}
        <Modal visible={isRenameModalVisible} transparent animationType="fade">
            <View style={styles.editModal}>
            <View style={styles.renameContainer}>
                <Text style={styles.modalTitle}>Rename Record</Text>
                <TextInput style={styles.renameInput} value={newDisplayName} onChangeText={setNewDisplayName} autoFocus />
                <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={[styles.modalButton, styles.cancelBtn]}>
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRename} style={[styles.modalButton, styles.saveBtn]}>
                    <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                </View>
            </View>
            </View>
        </Modal>
        {/* Loading Modal */}
        <Modal transparent animationType="fade" visible={isLoading} statusBarTranslucent={true}>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.message}>{statusMessage}</Text>
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
    height: '45%',
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dims the background
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxWidth: 280,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    // Elevation for Android
    elevation: 10,
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
});
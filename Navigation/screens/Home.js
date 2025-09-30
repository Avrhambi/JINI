import React, {useEffect, useState} from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, FlatList } from "react-native";
import { LinearGradient} from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {Audio} from "expo-av"
import {Ionicons} from '@expo/vector-icons';



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


export default function HomeScreen() {
  const [KeyWord, setKeyWord] = useState("");
  const [records, setRecords] = useState([]);
  const [expandedId, setExpandedId] = React.useState(null);
  const [favorites, setFavorites] = React.useState([]);
  const [currentTab, setCurrentTab] = React.useState("all"); // "all" | "favorites"


  const navigation = useNavigation();
  useEffect(() =>{
    async function fetchRecords() {
      const data = [
        { id: "1", title: "record1", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-01" , caller: "John Doe", phoneNumber: "123-456-7890"},
        { id: "2", title: "record2", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-02" , caller: "Jane Smith", phoneNumber: "234-567-8901"},
        { id: "3", title: "record3", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-03" , caller: "Alice Johnson", phoneNumber: "345-678-9012"},
        { id: "4", title: "record4", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-04" , caller: "Bob Brown", phoneNumber: "456-789-0123"},
        { id: "5", title: "record5", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-05" , caller: "Charlie Davis", phoneNumber: "567-890-1234"},
        { id: "6", title: "record6", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-06" , caller: "Diana Evans", phoneNumber: "678-901-2345"},
        { id: "7", title: "record7", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-07" , caller: "Ethan Foster", phoneNumber: "789-012-3456"},
        { id: "8", title: "record8", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-08" , caller: "Fiona Green", phoneNumber: "890-123-4567"},
        { id: "9", title: "record9", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-09" , caller: "George Harris", phoneNumber: "901-234-5678"},
        { id: "10", title: "record10", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-10" , caller: "Hannah Ivers", phoneNumber: "012-345-6789"},
        { id: "11", title: "record11", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-11" , caller: "Ian Johnson", phoneNumber: "123-456-7890"},
        { id: "12", title: "record12", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-12" , caller: "Jack Daniels", phoneNumber: "234-567-8901"},
        { id: "13", title: "record13", uri: require("../../assets/audio/audio-sample1.mp3"), date: "2023-10-13" , caller: "Karen White", phoneNumber: "345-678-9012"},
        { id: "14", title: "record14", uri: require("../../assets/audio/audio-sample2.mp3"), date: "2023-10-14" , caller: "Liam Brown", phoneNumber: "456-789-0123"},
      ];
    try {
      const withDurations = await Promise.all(data.map(async (rec) => {    
        try {
          const durationMs = await getAudioDuration(rec.uri);
          return { ...rec, duration: millisToMinutesAndSeconds(durationMs), expanded: false, favorite: false };
        } catch (error) {
          return { ...rec, duration: "Unknown", expanded: false, favorite: false};
        }
    }));
        setRecords(withDurations);
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
        <View style = {styles.menu}>  
          <View style = {styles.logo}>
            <Text style={styles.title}>JINI</Text>
            <Image
              source={require("../../assets/genie-512.png")} // path to your PNG
              style={styles.icon}
              resizeMode="center" // ensures it scales properly
            />
          </View>
          <TouchableOpacity style={styles.buttonText} onPress={() => navigation.navigate('Login')}>
            <Ionicons  name="log-in-outline" size = {35} color="black" ></Ionicons>
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
            const matchesSearch = r.title.toLowerCase().includes(KeyWord.toLowerCase());
            const matchesTab = currentTab === "all" || (currentTab === "favorites" && favorites.includes(r.id));
            return matchesTab && matchesSearch;
          }
          )} // search filter
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          
          renderItem={({ item }) => ( 
            <TouchableOpacity onPress={() => navigation.navigate('Listen', { record: item })}>
              <View style={styles.SearchResultItem}>
                <TouchableOpacity onPress={() => toggleExpand(item.id)}>
                  <Ionicons name={expandedId === item.id ? "chevron-down" : "chevron-forward"} size={25} color="white" 
                    resizeMode="center"/> 
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.Results}>{item.title}</Text>
                  <Text style={styles.ResultsInfo}>{item.duration}</Text>
                </View>
                {/* if the star is pressed it fill its else it is empty */}
                <TouchableOpacity onPress={() => toggleFavorite(item.id)}>
                  <Ionicons name={favorites.includes(item.id) ? "star" : "star-outline"} size={25} color="white"
                    resizeMode="center"
                  />
                </TouchableOpacity>
              </View>
              {expandedId === item.id && (
                <View style={styles.expandedResult}>
                  <Text style={styles.expandedResultsInfo}>Caller: {item.caller}</Text>
                  <Text style={styles.expandedResultsInfo}>Phone: {item.phoneNumber}</Text>
                  <Text style={styles.expandedResultsInfo}>Date: {item.date}</Text>
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

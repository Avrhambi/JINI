import React from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, Dimensions, Modal, ScrollView } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Slider from "@react-native-community/slider";

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = 320;
const THUMB_SIZE = 20; // The width of the round button you drag
const PADDING = 15.5; // The offset needed to match the track start

export default function ListenScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { record } = route.params;
    const [showTranscription, setShowTranscription] = React.useState(false);
    const [transcriptionText, setTranscriptionText] = React.useState("No transcription available.");
    const [serverMarkers, setServerMarkers] = React.useState([]);
    const [isSliding, setIsSliding] = React.useState(false);
    // Retrieve markers passed from Home.js search
    const markers = record.foundTimestamps || [];

    const soundRef = React.useRef(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [position, setPosition] = React.useState(0);
    const [duration, setDuration] = React.useState(0);

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // async function loadAudio() {
    //     if (!record?.recording?.uri) {
    //         console.error("No URI found");
    //         return;
    //     }

    //     try {
    //         const { sound: newSound } = await Audio.Sound.createAsync(
    //             { uri: record.recording.uri },
    //             { shouldPlay: false }
    //         );
    //         setSound(newSound);
    //         newSound.setOnPlaybackStatusUpdate(updateStatus);
    //     } catch (error) {
    //         console.error("Playback Error:", error);
    //         Alert.alert("Error", "Could not play this file type.");
    //     }
    // }

    // function updateStatus(status) {
    //     if (status.isLoaded) {
    //         setPosition(status.positionMillis / 1000);
    //         setDuration(status.durationMillis / 1000);
    //         setIsPlaying(status.isPlaying);
    //     }
    // }

    // // SKIP LOGIC: Moves to the next or previous keyword timestamp
    // async function skipToMarker(direction) {
    //     if (!sound || markers.length === 0) return;

    //     const currentPos = position;
    //     let target;

    //     if (direction === 'next') {
    //         // Find first marker that is after the current position
    //         target = markers.find(m => m > currentPos + 1);
    //         if (!target) target = markers[0]; // loop back to first
    //     } else {
    //         // Find the last marker that is before the current position
    //         target = [...markers].reverse().find(m => m < currentPos - 1);
    //         if (!target) target = markers[markers.length - 1]; // loop to last
    //     }

    //     await sound.setPositionAsync(target * 1000);
    // }

    // React.useEffect(() => {
    //     loadAudio();

    //     // FIXED CLEANUP: Ensures sound stops and memory is freed when leaving
    //     return () => {
    //     if (sound) {
    //         sound.stopAsync()
    //         .then(() => sound.unloadAsync())
    //         .catch(err => console.log("Cleanup error:", err));
    //     }
    //     };
    // }, [record, sound]); // Added sound to dependency to ensure cleanup has latest ref`

    // async function togglePlay() {
    //     if (!sound) return;
    //     if (isPlaying) {
    //         await sound.pauseAsync();
    //     } else {
    //         await sound.playAsync();
    //     }
    // }

    // async function seekAudio(value) {
    //     if (sound) {
    //         await sound.setPositionAsync(value * 1000);
    //     }
    // }

async function loadAudio() {
        if (!record?.recording?.uri) return;

        try {
            // Unload existing sound if it exists
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: record.recording.uri },
                { 
                    shouldPlay: false, 
                    progressUpdateIntervalMillis: 100
                }
            );
            
            soundRef.current = newSound;
            newSound.setOnPlaybackStatusUpdate(updateStatus);
        } catch (error) {
            console.error("Playback Error:", error);
        }
    }

    function updateStatus(status) {
        if (status.isLoaded) {
            if (!isSliding) {
                setPosition(status.positionMillis / 1000);
            }
            setDuration(status.durationMillis / 1000);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);

                if (soundRef.current) {
                    soundRef.current.stopAsync();
                    soundRef.current.setPositionAsync(0);
                }
            }
        }
    }

    React.useEffect(() => {
        loadAudio();

        // CLEANUP: This runs strictly when the component unmounts
        return () => {
            if (soundRef.current) {
                console.log("Cleaning up sound...");
                soundRef.current.stopAsync().then(() => {
                    soundRef.current.unloadAsync();
                    soundRef.current = null;
                }).catch(err => console.log("Cleanup ignored", err));
            }
        };
    }, [record]); // Only reload if the record changes

    async function togglePlay() {
        if (!soundRef.current) return;

        if (isPlaying) {
            await soundRef.current.pauseAsync();
        } else {
            if (position >= duration - 0.1 || duration === 0) {
                await soundRef.current.setPositionAsync(0);
            }
            await soundRef.current.playAsync();
        }
    }


    const onValueChange = (value) => {
        setIsSliding(true);
        setPosition(value);
    };

    async function seekAudio(value) {
        setIsSliding(false);
        if (soundRef.current) {
            await soundRef.current.setPositionAsync(value * 1000);
        }
    }

    async function skipToMarker(direction) {
        if (!soundRef.current || !markers.length) return;
        
        const currentPos = position;
        let target = null;

        if (direction === 'next') {
            // Find the next marker after current position
            target = markers.find(m => m > currentPos + 0.5); 
            // If no "next" marker exists, stay on the last one
            if (target === undefined) target = markers[markers.length - 1];
        } else {
            // Find previous marker
            target = [...markers].reverse().find(m => m < currentPos - 0.5);
            // If no "previous" marker exists, stay on the first one
            if (target === undefined) target = markers[0];
        }

        if (target !== null) {
            await soundRef.current.setPositionAsync(target * 1000);
        }
    }

    React.useEffect(() => {
        const fetchTranscription = async () => {
            try {
                const key = `transcription_${record.recording.name}`;
                const savedData = await AsyncStorage.getItem(key);
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    console.log(parsed);
                    setTranscriptionText(parsed.transcript || "No text found.");
                    if (parsed.timestamps) setServerMarkers(parsed.timestamps);
                }
            } catch (e) {
                console.log("Error loading transcription", e);
            }
        };
        fetchTranscription();
    }, [record]);

    return (
        <LinearGradient
            colors={["#E1E6E7", "#ADC3C7", "#424242"]}
            locations={[0.25, 0.63, 1]}
            style={styles.container}
        >
            <View style={styles.topSection}>
                <View style={styles.menu}>
                    <TouchableOpacity 
                        style={{ position: 'absolute', left: 20 }} 
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={35} color="black" />
                    </TouchableOpacity>
                    <View style={styles.logo}>
                        <Text style={styles.title}>JINI</Text>
                        <Image
                            source={require("../../assets/genie-512.png")}
                            style={styles.icon}
                            resizeMode="center"
                        />
                    </View>
                </View>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>

            <View style={styles.middleSection}>
                <Image
                    source={require("../../assets/audio.png")}
                    style={styles.Audioicon}
                />
            </View>
            </View>

            <View style={styles.bottomSection}>
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}>
                    <Text style={styles.recordName}>{record.metadata?.visibleName || record.recording.name}</Text>
                    <TouchableOpacity 
                        style={styles.transcriptionBtn} 
                        onPress={() => setShowTranscription(true)}
                    >
                        <Ionicons name="document-text-outline" size={20} color="white" />
                        {/* <Text style={styles.transcriptionBtnText}>View Transcription</Text> */}
                    </TouchableOpacity>
                    
                </View>
                {/* Slider Wrapper to hold Markers */}
                {/* <View style={styles.sliderWrapper}>
                    <Slider
                        style={{ width: 320, height: 40, zIndex: 10 }}
                        minimumValue={0}
                        maximumValue={duration}
                        value={position}
                        onSlidingComplete={seekAudio}
                        minimumTrackTintColor="#fff"
                        maximumTrackTintColor="rgba(46, 46, 46, 0.5)"
                        thumbTintColor="#fff"
                    />
                    
                    {/* KEYWORD MARKERS (Lines) */}
                    {/* {markers.map((time, index) => (
                        <View
                            key={index}
                            style={[
                                styles.marker,
                                { left: (time / duration) * 100 + "%" }
                            ]}
                        />
                    ))}
                </View> */} 
                <View style={styles.sliderContainer}>
                    {/* The Markers Layer */}
                    <View style={styles.markersOverlay}>
                        {duration > 0 && markers.map((time, index) => {
                            const markerWidth = 12; // Must match your style width
                            // Formula: Start Padding + (Percent * Available Track) - (Half of Marker Width)
                            const positionOnTrack = PADDING + ((time / duration) * (SLIDER_WIDTH - (PADDING * 2))) - (markerWidth / 2);

                            return (
                                <View
                                    key={index}
                                    style={[
                                        styles.markerCircle,
                                        { left: positionOnTrack }
                                    ]}
                                />
                            );
                        })}
                    </View>
                    
                    <Slider
                        style={{ width: SLIDER_WIDTH, height: 40 , marginHorizontal: 0, padding: 0 }}
                        minimumValue={0}
                        maximumValue={duration}
                        value={position}
                        onValueChange={onValueChange}
                        onSlidingComplete={seekAudio}
                        minimumTrackTintColor="#fff"
                        maximumTrackTintColor="rgba(46, 46, 46, 1)"
                        thumbTintColor="#fff"

                    />
                </View>

                <View style={styles.timeRow}>
                    <Text style={{ color: "#fff" }}>{formatTime(position)}</Text>
                    <Text style={{ color: "#fff" }}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.controls}>
                    {/* Previous Marker */}
                    <TouchableOpacity onPress={() => skipToMarker('prev')}>
                        <Ionicons name="play-skip-back" size={35} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={togglePlay}>
                        <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={80} color="#fff" />
                    </TouchableOpacity>

                    {/* Next Marker */}
                    <TouchableOpacity onPress={() => skipToMarker('next')}>
                        <Ionicons name="play-skip-forward" size={35} color="#fff" />
                    </TouchableOpacity>
                </View>
                {/* Transcription Trigger Button */}
                

                {/* Sliding Bottom Sheet (Modal) */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showTranscription}
                    onRequestClose={() => setShowTranscription(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={styles.dragHandle} />
                                <TouchableOpacity onPress={() => setShowTranscription(false)}>
                                    <Ionicons name="close-circle" size={30} color="#ccc" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalTitle}>Transcription</Text>
                            <ScrollView contentContainerStyle={styles.scrollContainer}>
                                <Text style={styles.transcriptionContent}>{transcriptionText}</Text>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    topSection: { flex: 0.5, justifyContent: "flex-start", alignItems: "center", paddingTop: 40 },
    menu: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: '100%' },
    logo: { alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 32, fontFamily: "Bitter-Regular", color: "#000", marginTop: 10 },
    icon: { width: 39, height: 39, marginBottom: 10 },
    middleSection: { flex: 1.5, justifyContent: "center", alignItems: "center" },
    recordName: { color: '#fff', fontSize: 16 },
    Audioicon: { width: 250, height: 190, resizeMode: "contain", },
    bottomSection: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 80 },
    
    // MARKER STYLING
    sliderWrapper: { width: 300, height: 40, justifyContent: 'center', position: 'relative' },
    marker: {
        position: 'absolute',
        width: 2,
        height: 14,             // Height of the blue bar
        backgroundColor: '#3498db', // Blue color as requested
        zIndex: 5,              // Below the slider thumb
        top: '50%',
        marginTop: -7,          // Centers the 14px bar vertically
    },

    controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", width: "80%", marginTop: 0 },
    timeRow: { width: "80%", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
    sliderContainer: { 
        width: SLIDER_WIDTH, 
        height: 40, 
        justifyContent: 'center',
        alignItems: 'center', 
    },
    markersOverlay: { 
        justifyContent: 'center',
        height: 40,
        width: SLIDER_WIDTH,
        position: 'absolute',
    },
    marker: {
        position: 'absolute',
        width: 2,         // Slightly thicker for visibility
        height: 18,          // Taller to look like the screenshot
        backgroundColor: '#3498db',
        borderRadius: 1,
    },
markerCircle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', 
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    top: '50%',
    marginTop: -6,
    // Add a subtle blue glow
    shadowColor: "#3498db",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 50,
    zIndex: 0,

},

    transcriptionBtn: {
        backgroundColor: 'rgba(255,255,255,0.0)',
        justifyContent: 'center',
    },
    transcriptionBtnText: { color: 'white', marginLeft: 8, fontWeight: 'bold' },

    // Modal / Bottom Sheet Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        height: '60%', // Adjust height as needed
        width: '100%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#eee',
        borderRadius: 10,
        position: 'absolute',
        left: '50%',
        marginLeft: -20,
        top: -5
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#333', textAlign: 'center' },
    scrollContainer: { paddingBottom: 40 },
    transcriptionContent: { 
        fontSize: 16, 
        lineHeight: 24, 
        color: '#444', 
        textAlign: 'right' 
    }
});
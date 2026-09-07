import React, { useState, useEffect, useRef } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  Modal, 
  ScrollView 
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import Slider from "@react-native-community/slider";

// Services
import { 
  formatTime, 
  setupAudio, 
  getLocalTranscription, 
  getMarkerTarget 
} from "../../services/ListenServices";

const SLIDER_WIDTH = 320;
const PADDING = 15.5;

export default function ListenScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { record } = route.params;

  // --- UI State ---
  const [showTranscription, setShowTranscription] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState("No transcription available.");
  const [isSliding, setIsSliding] = useState(false);

  // --- Audio State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const soundRef = useRef(null);
  const markers = record.foundTimestamps || [];

  // --- Audio Handlers ---
  const updateStatus = (status) => {
    if (status.isLoaded) {
      if (!isSliding) {
        setPosition(status.positionMillis / 1000);
      }
      setDuration(status.durationMillis / 1000);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        soundRef.current?.stopAsync();
        soundRef.current?.setPositionAsync(0);
      }
    }
  };

  const loadAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    const sound = await setupAudio(record?.recording?.uri, updateStatus);
    soundRef.current = sound;
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (position >= duration - 0.1 || duration === 0) {
        await soundRef.current.setPositionAsync(0);
      }
      await soundRef.current.playAsync();
    }
  };

  const seekAudio = async (value) => {
    setIsSliding(false);
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(value * 1000);
    }
  };

  const skipToMarker = async (direction) => {
    const target = getMarkerTarget(direction, position, markers);
    if (target !== null && soundRef.current) {
      await soundRef.current.setPositionAsync(target * 1000);
    }
  };

  // --- Lifecycle & Effects ---
  useEffect(() => {
    loadAudio();
    
    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [record]);

  useEffect(() => {
    const fetchTranscription = async () => {
      const data = await getLocalTranscription(record.recording.name);
      if (data) {
        setTranscriptionText( data || "No text found.");
      }
    };
    fetchTranscription();
  }, [record]);

  // --- Render Markers ---
  const renderMarkers = () => {
    if (duration <= 0) return null;

    return markers.map((time, index) => {
      const markerWidth = 12;
      const trackRange = SLIDER_WIDTH - (PADDING * 2);
      const positionOnTrack = PADDING + ((time / duration) * trackRange) - (markerWidth / 2);

      return (
        <View 
          key={index} 
          style={[styles.markerCircle, { left: positionOnTrack }]} 
        />
      );
    });
  };

  return (
    <LinearGradient
      colors={["#E1E6E7", "#ADC3C7", "#424242"]}
      locations={[0.25, 0.63, 1]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.topSection}>
        <View style={styles.menu}>
          <TouchableOpacity 
            style={styles.backBtn} 
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

      {/* Visualizer / Center Icon */}
      <View style={styles.mainContent}>
        <View style={styles.middleSection}>
          <Image
            source={require("../../assets/audio.png")}
            style={styles.Audioicon}
          />
        </View>
      </View>

      {/* Controls Section */}
      <View style={styles.bottomSection}>
        <View style={styles.headerRow}>
          <Text style={styles.recordName}>
            {record.metadata?.visibleName || record.recording.name}
          </Text>
          <TouchableOpacity 
            style={styles.transcriptionBtn} 
            onPress={() => setShowTranscription(true)}
          >
            <Ionicons name="document-text-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.sliderContainer}>
          <View style={styles.markersOverlay}>
            {renderMarkers()}
          </View>
          
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            onValueChange={(val) => { setIsSliding(true); setPosition(val); }}
            onSlidingComplete={seekAudio}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(46, 46, 46, 1)"
            thumbTintColor="#fff"
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={() => skipToMarker('prev')}>
            <Ionicons name="play-skip-back" size={35} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay}>
            <Ionicons 
              name={isPlaying ? "pause-circle" : "play-circle"} 
              size={80} 
              color="#fff" 
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => skipToMarker('next')}>
            <Ionicons name="play-skip-forward" size={35} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Transcription Modal */}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  topSection: {
    flex: 0.5,
    justifyContent: "flex-start", 
    alignItems: "center", 
    paddingTop: 40 
  },
  menu: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    width: '100%' 
  },
  backBtn: { 
    position: 'absolute', 
    left: 20 
  },
  logo: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  title: { 
    fontSize: 32, 
    fontFamily: "Bitter-Regular", 
    color: "#000", 
    marginTop: 10 
  },
  icon: { 
    width: 39, 
    height: 39, 
    marginBottom: 10 
  },
  mainContent: { 
    alignItems: 'center', 
    flex: 1 
  },
  middleSection: {    
    flex: 1.5, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  Audioicon: { 
    width: 250, 
    height: 190, 
    resizeMode: "contain" 
  },
  bottomSection: { 
    flex: 1, 
    justifyContent: "flex-end", 
    alignItems: "center", 
    paddingBottom: 80 
  },
  headerRow: { 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center'
  },
  recordName: { 
    color: '#fff', 
    fontSize: 16 
  },
  transcriptionBtn: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  sliderContainer: { 
    width: SLIDER_WIDTH, 
    height: 40, 
    justifyContent: 'center',
    alignItems: 'center', 
  },
  slider: { 
    width: SLIDER_WIDTH, 
    height: 40 
  },
  markersOverlay: { 
    justifyContent: 'center',
    height: 40,
    width: SLIDER_WIDTH,
    position: 'absolute',
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
    elevation: 5,
    zIndex: 0,
  },
  timeRow: { 
    width: "80%", 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: 10 
  },
  timeText: { 
    color: "#fff" 
  },
  controls: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-around", 
    width: "80%", 
    marginTop: 10 
  },
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
    height: '60%',
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
  modalTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    color: '#333', 
    textAlign: 'center' 
  },
  scrollContainer: { 
    paddingBottom: 40 
  },
  transcriptionContent: { 
    fontSize: 16, 
    lineHeight: 24, 
    color: '#444', 
    textAlign: 'right' 
  }
});
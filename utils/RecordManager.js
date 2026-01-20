import * as SecureStore from 'expo-secure-store';   
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Technical File Stats (Size, Duration, ModTime)
const getAudioFileInfo = async (uri) => {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        const { sound } = await Audio.Sound.createAsync({ uri });
        const status = await sound.getStatusAsync();
        const duration = status.durationMillis / 1000;
        await sound.unloadAsync();

        return {
            size: info.size,
            modificationTime: info.modificationTime ? info.modificationTime * 1000 : null,
            duration: duration
        };
    } catch (e) {
        console.error("Audio Info Error:", e);
        return { size: 0, modificationTime: null, duration: 0 };
    }
};

// 2. Call Type Labeling (Matching your exact logic)
const getCallTypeLabel = (type) => {
    switch (type) {
        case '1': return 'Incoming';
        case '2': return 'Outgoing';
        case '3': return 'Missed';
        default: return 'Call';
    }
};

// 3. Matching Logic (The exact logic from earlier)
const findMatchInLogs = (fileName, fileTimestamp, fileModTime, logs) => {
    return logs.find(log => {
        const logDate = parseInt(log.date);

        // A. Exact 13-digit timestamp match (within 10s)
        if (fileTimestamp) {
            return Math.abs(fileTimestamp - logDate) < 10000;
        }

        // B. Fuzzy match (Number in name + Time window)
        const cleanLogNumber = log.number.replace(/\D/g, '');
        const numberMatch = cleanLogNumber.length > 5 && fileName.includes(cleanLogNumber);
        const isRecent = Math.abs(fileModTime - logDate) < 60000;

        return numberMatch && isRecent;
    });
};

// 4. Metadata Builder (Standardizes the object for List and Backend)
const buildFullMetadata = async (log, stats, fileName) => {
    const storedUser = await SecureStore.getItemAsync("userInfo");
    const userInfo = storedUser ? JSON.parse(storedUser) : null;

    const logDate = parseInt(log.date);
    const dateObj = new Date(logDate);


    const displayDate = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const displayTime = dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const fullDateTime = dateObj.toLocaleString('he-IL');
    const callDateISO = dateObj.toISOString();


    const savedNames = await AsyncStorage.getItem('custom_names');
    const namesObj = savedNames ? JSON.parse(savedNames) : {};
    const persistedName = namesObj[fileName];
    const savedFavorites = await AsyncStorage.getItem('favorite_records');
    const favoriteRecords = savedFavorites ? JSON.parse(savedFavorites) : [];
    
    const metadata = {

    visibleName: persistedName || (log.alias && log.alias !== 'null' ? log.alias : fileName),
    originalFileName: fileName,
    caller_name: log.name && log.name !== 'null' ? log.name : 'Unknown',
    number: log.number,
    type: getCallTypeLabel(log.type), // Using the helper here
    realDuration: stats.duration,
    // callDate: `${displayDate} ${displayTime}`,
    // callDateISO: callDateISO,
    date: fullDateTime,
    favoriteRecords: favoriteRecords,

    };
    return metadata;
};
export {
    getAudioFileInfo,
    getCallTypeLabel,
    findMatchInLogs,
    buildFullMetadata
};
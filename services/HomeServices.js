import * as FileSystem from "expo-file-system";
import { NativeModules, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAudioFileInfo, findMatchInLogs, buildFullMetadata } from "../utils/RecordManager";
import { getAccessToken, removeUserCredentials } from "../utils/auth";
import { apiFetch } from "../utils/api";

const audioDir = FileSystem.documentDirectory + "PhoneRecords/";
const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

// Ensure the directory exists
export const ensureDirectory = async () => {
    const folderInfo = await FileSystem.getInfoAsync(audioDir);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    }
};

// Load and merge local records with call logs
export const loadLocalRecords = async (setFavorites) => {
  try {
    const [savedFavsStr, logs, fileNames] = await Promise.all([
      AsyncStorage.getItem('favorite_records'),
      NativeModules.CallLogModule.getCallLogs(),
      FileSystem.readDirectoryAsync(audioDir)
    ]);

    const localFavorites = savedFavsStr ? JSON.parse(savedFavsStr) : [];
    setFavorites(localFavorites);

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
        isLocal: true,
        isFavorite: localFavorites.includes(name)
      };
    }));

    return localMerged.filter(Boolean).sort((a, b) => parseInt(b.date) - parseInt(a.date));
  } catch (error) {
    throw new Error("Failed to load local records");
  }
};

// Search logic via backend
export const searchRecords = async (query, allRecords) => {
  try {
    const formData = new FormData();
    formData.append('query', query);

    const response = await apiFetch(`/calls/search`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const searchData = await response.data;
      return allRecords.map(record => {
      const serverMatch = searchData.find(s => s.file_name === record.recording.name);
      return serverMatch ? { ...record, foundTimestamps: serverMatch.time_stamps } : null;
    }).filter(Boolean);
    } else {
      throw new Error("Search request failed");
    }
  } catch (error) {
    throw new Error("Search failed");
  }
};

// Toggle Favorites
export const updateFavoriteStatus = async (recordName, isFavorite, favorites) => {
  try {
    const endpoint = isFavorite ? 'remove' : 'add';
    const formData = new FormData();
    formData.append('original_name', recordName);

    const response = await apiFetch(`/calls/favorites/${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const updated = isFavorite 
        ? favorites.filter(id => id !== recordName) 
        : [...favorites, recordName];
      await AsyncStorage.setItem('favorite_records', JSON.stringify(updated));
      return updated;
    }
    else {
      throw new Error("Favorite update request failed");  
    }
  } catch (error) {
    throw new Error("Favorite update failed");
  }
};

// Rename Record
export const renameRecord = async (recordName, newName) => {
  try {
    const formData = new FormData();
    formData.append('original_name', recordName);
    formData.append('new_name', newName);

    const response = await apiFetch(`/calls/rename`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const savedNames = await AsyncStorage.getItem('custom_names');
      const namesObj = savedNames ? JSON.parse(savedNames) : {};
      namesObj[recordName] = newName;
      await AsyncStorage.setItem('custom_names', JSON.stringify(namesObj));
      return true;
    }
    return false;
  } catch (error) {
    throw new Error("Rename failed");
  }
};

// Delete Record
export const deleteRecord = async (record) => {
  try {
    const formData = new FormData();
    formData.append('original_name', record.recording.name);

    const response = await apiFetch(`/calls/delete`, {
      method: 'DELETE',
      body: formData
    });

    if (response.ok) {
      await FileSystem.deleteAsync(record.recording.uri);
      const  savedNames = await AsyncStorage.getItem('custom_names');
      if (savedNames) {
        const namesObj = JSON.parse(savedNames);
        delete namesObj[record.recording.name];
        await AsyncStorage.setItem('custom_names', JSON.stringify(namesObj));
      }
      return true;
    }
    return false;
  } catch (error) {
    throw new Error("Delete failed");
  }
};

// Delete Account
export const deleteAccount = async () => {
  try {
    const response = await apiFetch(`/users/delete`, {
      method: 'DELETE',
    });
    if (response.ok) {
      await Promise.all([
        AsyncStorage.removeItem('favorite_records'),
        AsyncStorage.removeItem('custom_names'),
        AsyncStorage.removeItem('user_name')
      ]);
      return true;
    }
    return false;
  } catch (error) {
    throw new Error("Delete account failed: " + error.message);
  }
};

// Upload Audio File
export const uploadAudioFile = async (file) => {
  try {
    // 1. Save Locally
    const destPath = audioDir + file.name;
    await FileSystem.copyAsync({ from: file.uri, to: destPath });

    // 2. Get Audio Stats & Token
    const stats = await getAudioFileInfo(destPath);
    const token = await getAccessToken();
    if (!token) throw new Error("Session expired");

    // 3. Match with Call Logs
    const logs = await NativeModules.CallLogModule.getCallLogs();
    const timestampMatch = file.name.match(/\d{13}/);
    const fileTimestamp = timestampMatch ? parseInt(timestampMatch[0]) : null;
    const matchedLog = findMatchInLogs(file.name, fileTimestamp, stats.modificationTime, logs);

    // 4. Build Metadata
    let finalMetadata;
    if (matchedLog) {
      finalMetadata = await buildFullMetadata(matchedLog, stats, file.name);
    } else {
      finalMetadata = {
        visibleName: file.name,
        originalFileName: file.name,
        caller_name: "Imported",
        number: "Unknown",
        type: "Manual",
        date: new Date().toISOString(),
        realDuration: "00:00",
      };
    }

    // 5. Prepare Multipart Upload
    const formData = new FormData();
    formData.append('audio_file', { 
      uri: file.uri, 
      name: file.name, 
      type: file.mimeType || 'audio/wav' 
    });
    formData.append('original_name', file.name);
    formData.append('display_name', finalMetadata.visibleName);
    formData.append('caller_name', finalMetadata.caller_name);
    formData.append('number', finalMetadata.number);
    formData.append('type', finalMetadata.type);
    formData.append('date', finalMetadata.date);

    // 6. Execute Upload
    const response = await apiFetch(`/calls/upload`, {
      method: 'POST',
      body: formData,
    });


    if (response.ok) {
      const serverData = await response.data;
      // Store transcription locally for Listen.js
      await AsyncStorage.setItem(`transcription_${file.name}`, JSON.stringify(serverData.transcript || {}));
      return true;
    } else {
      const errorData = response.data;
      throw new Error(errorData.detail || "Upload failed");
    }
  } catch (error) {
    throw new Error("Upload failed: " + error.message);
  }
};
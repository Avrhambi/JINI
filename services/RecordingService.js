import RNFS from 'react-native-fs';
import ShizukuModule from '../modules/shizuku/ShizukuModule';
import ShizukuPermissions from '../permissions/ShizukuPermissions';
import {
  parseRecordingsList,
  getPublicRecordingsPath,
  getPublicFilePath,
  matchRecordingWithCall,
} from '../utils/recordingUtils';

class RecordingService {
  constructor() {
    this.syncInProgress = false;
  }

  /**
   * Initialize the service and ensure permissions
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      const hasPermission = await ShizukuPermissions.ensurePermission();
      
      if (!hasPermission) {
        return false;
      }

      // Ensure public directory exists
      await this.ensurePublicDirectoryExists();
      
      return true;
    } catch (error) {
      console.error('Error initializing RecordingService:', error);
      return false;
    }
  }

  /**
   * Ensure the public recordings directory exists
   */
  async ensurePublicDirectoryExists() {
    const publicPath = getPublicRecordingsPath();
    const exists = await RNFS.exists(publicPath);
    
    if (!exists) {
      await RNFS.mkdir(publicPath);
      console.log('Created public recordings directory');
    }
  }

  /**
   * Get all recordings from the private dialer directory
   * @returns {Promise<Array>}
   */
  async getAllRecordingsFromDialer() {
    try {
      const output = await ShizukuModule.listRecordings();
      return parseRecordingsList(output);
    } catch (error) {
      console.error('Error getting recordings from dialer:', error);
      return [];
    }
  }

  /**
   * Get recordings that are already in public storage
   * @returns {Promise<Array>}
   */
  async getExistingPublicRecordings() {
    try {
      const publicPath = getPublicRecordingsPath();
      const files = await RNFS.readDir(publicPath);
      
      return files
        .filter(file => 
          file.name.endsWith('.m4a') || 
          file.name.endsWith('.mp3') || 
          file.name.endsWith('.3gp') ||
          file.name.endsWith('.wav')
        )
        .map(file => ({
          name: file.name,
          path: file.path,
          size: file.size,
          mtime: file.mtime,
        }));
    } catch (error) {
      console.error('Error getting public recordings:', error);
      return [];
    }
  }

  /**
   * Find new recordings that haven't been copied yet
   * @returns {Promise<Array>}
   */
  async findNewRecordings() {
    const allRecordings = await this.getAllRecordingsFromDialer();
    const existingRecordings = await this.getExistingPublicRecordings();
    
    const existingNames = existingRecordings.map(r => r.name);
    
    return allRecordings.filter(
      recording => !existingNames.includes(recording.name)
    );
  }

  /**
   * Copy a single recording to public storage
   * @param {string} fileName
   * @returns {Promise<boolean>}
   */
  async copyRecordingToPublic(fileName) {
    try {
      const destination = getPublicFilePath(fileName);
      await ShizukuModule.copyRecording(fileName, destination);
      console.log(`Copied recording: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Error copying recording ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Sync all new recordings from dialer to public storage
   * @returns {Promise<{success: boolean, copiedCount: number, failedCount: number}>}
   */
  async syncNewRecordings() {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { success: false, copiedCount: 0, failedCount: 0 };
    }

    this.syncInProgress = true;

    try {
      const newRecordings = await this.findNewRecordings();
      
      if (newRecordings.length === 0) {
        console.log('No new recordings to sync');
        this.syncInProgress = false;
        return { success: true, copiedCount: 0, failedCount: 0 };
      }

      console.log(`Found ${newRecordings.length} new recordings`);

      let copiedCount = 0;
      let failedCount = 0;

      for (const recording of newRecordings) {
        const success = await this.copyRecordingToPublic(recording.name);
        if (success) {
          copiedCount++;
        } else {
          failedCount++;
        }
      }

      console.log(`Sync complete: ${copiedCount} copied, ${failedCount} failed`);
      
      this.syncInProgress = false;
      return { success: true, copiedCount, failedCount };
      
    } catch (error) {
      console.error('Error during sync:', error);
      this.syncInProgress = false;
      return { success: false, copiedCount: 0, failedCount: 0 };
    }
  }

  /**
   * Get all recordings with their matched call history
   * @param {Array} callHistory - Array of call history objects
   * @returns {Promise<Array>}
   */
  async getRecordingsWithCallHistory(callHistory) {
    const recordings = await this.getExistingPublicRecordings();
    
    return recordings.map(recording => {
      const matchedCall = matchRecordingWithCall(recording, callHistory);
      
      return {
        ...recording,
        call: matchedCall,
        hasMatchedCall: !!matchedCall,
      };
    });
  }

  /**
   * Get only calls that have recordings
   * @param {Array} callHistory
   * @returns {Promise<Array>}
   */
  async getCallsWithRecordings(callHistory) {
    const recordings = await this.getExistingPublicRecordings();
    
    return callHistory
      .map(call => {
        const matchedRecording = recordings.find(recording => {
          const matched = matchRecordingWithCall(recording, [call]);
          return matched !== null;
        });
        
        return {
          ...call,
          recording: matchedRecording,
          hasRecording: !!matchedRecording,
        };
      })
      .filter(call => call.hasRecording);
  }

  /**
   * Delete a recording from public storage
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async deleteRecording(filePath) {
    try {
      await RNFS.unlink(filePath);
      console.log(`Deleted recording: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }
}

export default new RecordingService();
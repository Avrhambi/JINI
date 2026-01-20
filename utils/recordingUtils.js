/**
 * Parse the output from ls command to extract file information
 * @param {string} lsOutput - Raw output from ls -la command
 * @returns {Array<{name: string, size: number, date: string}>}
 */
export function parseRecordingsList(lsOutput) {
  if (!lsOutput) return [];

  const lines = lsOutput.split('\n');
  const recordings = [];

  for (const line of lines) {
    // Filter only audio files
    if (!line.includes('.m4a') && !line.includes('.mp3') && !line.includes('.3gp') && !line.includes('.wav')) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    
    if (parts.length >= 9) {
      recordings.push({
        name: parts[parts.length - 1],
        size: parseInt(parts[4]) || 0,
        date: `${parts[5]} ${parts[6]} ${parts[7]}`,
      });
    }
  }

  return recordings;
}

/**
 * Extract timestamp from recording filename
 * Assumes format like: recording_20241015_143022.m4a
 * @param {string} fileName
 * @returns {Date|null}
 */
export function extractTimestampFromFilename(fileName) {
  // Match patterns like: YYYYMMDD_HHMMSS
  const dateMatch = fileName.match(/(\d{8})_(\d{6})/);
  
  if (dateMatch) {
    const dateStr = dateMatch[1]; // YYYYMMDD
    const timeStr = dateMatch[2]; // HHMMSS
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    const second = timeStr.substring(4, 6);
    
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  }
  
  return null;
}

/**
 * Extract phone number from filename if present
 * @param {string} fileName
 * @returns {string|null}
 */
export function extractPhoneNumberFromFilename(fileName) {
  // Match patterns with phone numbers (10+ digits)
  const phoneMatch = fileName.match(/(\d{10,})/);
  return phoneMatch ? phoneMatch[1] : null;
}

/**
 * Format file size to human-readable format
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Match a recording with a call from call history
 * @param {Object} recording - Recording object with name, date
 * @param {Array} callHistory - Array of call history objects
 * @returns {Object|null} Matched call or null
 */
export function matchRecordingWithCall(recording, callHistory) {
  const recordingTimestamp = extractTimestampFromFilename(recording.name);
  const recordingPhone = extractPhoneNumberFromFilename(recording.name);
  
  for (const call of callHistory) {
    // Method 1: Match by phone number
    if (recordingPhone && call.phoneNumber) {
      const cleanCallNumber = call.phoneNumber.replace(/\D/g, '');
      if (cleanCallNumber.includes(recordingPhone) || recordingPhone.includes(cleanCallNumber)) {
        return call;
      }
    }
    
    // Method 2: Match by timestamp (within 2 minutes tolerance)
    if (recordingTimestamp && call.timestamp) {
      const callTime = new Date(call.timestamp).getTime();
      const recordingTime = recordingTimestamp.getTime();
      const timeDiff = Math.abs(callTime - recordingTime);
      
      // 2 minutes = 120000 milliseconds
      if (timeDiff < 120000) {
        return call;
      }
    }
  }
  
  return null;
}

/**
 * Get public storage path for recordings
 * @returns {string}
 */
export function getPublicRecordingsPath() {
  return '/storage/emulated/0/CallRecordings/';
}

/**
 * Get file path in public storage
 * @param {string} fileName
 * @returns {string}
 */
export function getPublicFilePath(fileName) {
  return `${getPublicRecordingsPath()}${fileName}`;
}
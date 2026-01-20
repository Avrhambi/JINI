// import { NativeModules } from 'react-native';

// const { ShizukuModule } = NativeModules;

// // Wrapper class for the native Shizuku module
// class ShizukuInterface {
//   /**
//    * Check if Shizuku service is running
//    * @returns {Promise<boolean>}
//    */
//   async isAvailable() {
//     try {
//       return await ShizukuModule.isShizukuAvailable();
//     } catch (error) {
//       console.error('Error checking Shizuku availability:', error);
//       return false;
//     }
//   }

//   /**
//    * Request Shizuku permission
//    * @returns {Promise<boolean>}
//    */
//   async requestPermission() {
//     try {
//       return await ShizukuModule.requestPermission();
//     } catch (error) {
//       console.error('Error requesting Shizuku permission:', error);
//       throw error;
//     }
//   }

//   /**
//    * List all recordings in the private directory
//    * @returns {Promise<string>} Raw output from ls command
//    */
//   async listRecordings() {
//     try {
//       return await ShizukuModule.listRecordings();
//     } catch (error) {
//       console.error('Error listing recordings:', error);
//       throw error;
//     }
//   }

//   /**
//    * Copy a recording from private to public directory
//    * @param {string} fileName - Name of the file to copy
//    * @param {string} destination - Destination path
//    * @returns {Promise<boolean>}
//    */
//   async copyRecording(fileName, destination) {
//     try {
//       return await ShizukuModule.copyRecording(fileName, destination);
//     } catch (error) {
//       console.error('Error copying recording:', error);
//       throw error;
//     }
//   }
// }

// export default new ShizukuInterface();


import { NativeModules } from 'react-native';

const { ShizukuModule } = NativeModules;

class ShizukuInterface {
  /**
   * Wait helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Shizuku service is running
   * @returns {Promise<boolean>}
   */
  async isAvailable(retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
      try {
        const available = await ShizukuModule.isShizukuAvailable();
        console.log(`[Shizuku] Availability check #${i + 1}:`, available);
        if (available) return true;
      } catch (error) {
        console.warn(`[Shizuku] Error checking availability (try ${i + 1}):`, error);
      }
      if (i < retries - 1) {
        console.log(`[Shizuku] Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }
    console.error('[Shizuku] Service not available after retries');
    return false;
  }

  async waitForBinder(retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      const available = await this.isAvailable();
      if (available) return true;
      await new Promise(res => setTimeout(res, delay));
    }
    return false;
  }

  /**
   * Request Shizuku permission
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      console.log('[Shizuku] Requesting permission...');
      let result = await ShizukuModule.requestPermission();
      if (!result) {
        console.warn('retrying after waiting for binder...');
        await this.waitForBinder();
        result = await ShizukuModule.requestPermission();
      }
      console.log('[Shizuku] Permission result:', result);
      return result;
    } catch (error) {
      console.error('[Shizuku] Error requesting permission:', error);
      throw error;
    }
  }

  /**
   * Initialize Shizuku connection (should be called once at app startup)
   */
  async initialize() {
    console.log('[Shizuku] Initialization started...');
    const available = await this.isAvailable();
    if (!available) {
      console.error('[Shizuku] Binder not received — please make sure Shizuku is running and authorized.');
      return false;
    }

    try {
      const permission = await this.requestPermission();
      console.log('[Shizuku] Permission granted:', permission);
      return true;
    } catch (error) {
      console.error('[Shizuku] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * List all recordings in the private directory
   * @returns {Promise<string>}
   */
  async listRecordings() {
    try {
      return await ShizukuModule.listRecordings();
    } catch (error) {
      console.error('[Shizuku] Error listing recordings:', error);
      throw error;
    }
  }

  /**
   * Copy a recording from private to public directory
   * @param {string} fileName - Name of the file to copy
   * @param {string} destination - Destination path
   * @returns {Promise<boolean>}
   */
  async copyRecording(fileName, destination) {
    try {
      return await ShizukuModule.copyRecording(fileName, destination);
    } catch (error) {
      console.error('[Shizuku] Error copying recording:', error);
      throw error;
    }
  }
}

export default new ShizukuInterface();

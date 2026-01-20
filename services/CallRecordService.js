import RNFS from 'react-native-fs';

export async function getCallRecordings() {
  const dir = '/storage/emulated/0/Call/'; // adjust path if needed
  try {
    const files = await RNFS.readDir(dir);
    const recordings = files
      .filter(f =>  f.name.endsWith('.wav'))
      .map(f => ({
        name: f.name,
        path: f.path,
        modified: f.mtime?.getTime() || 0,
      }));
    return recordings;
  } catch (error) {
    console.error('Error reading call recordings:', error);
    return [];
  }
}

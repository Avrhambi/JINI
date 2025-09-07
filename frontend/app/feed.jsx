import { StyleSheet, Text, View } from 'react-native'
import { Button } from 'react-native'
import { removeUserCredentials } from '../utils/auth';

const feed = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await removeUserCredentials();  // clear stored tokens
      router.replace('/');    // redirect to homepage
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Logout" onPress={handleLogout} />   
      <Text>Feed</Text>
    </View>
  );
};

export default feed

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    }
})
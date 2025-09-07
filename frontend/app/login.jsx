
import React from 'react';
import { StyleSheet, Text, View, TextInput, Button, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import {  saveUserCredentials } from '../utils/auth'; 




const Login = () => {
    const [email, setEmail] = React.useState(''); 
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const router = useRouter();
    const allFieldsFilled = email && password ;

const handle_login = async () => {
    if (!allFieldsFilled) {
        setError('All fields are required.');
        return;
    }

    setLoading(true);
    setError('');

    try {
        const response = await fetch('http://192.168.1.144:8000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        setLoading(false);

        if (response.ok) {
            // ✅ Login successful
            await saveUserCredentials(data.access_token, data.refresh_token);
            router.replace('/feed');
        } else {
            setError(data.detail || 'Login failed. Please try again.');
        }
    } catch (error) {
        setLoading(false);
        console.error('Network error:', error);
        setError('Network error. Please try again.');
    }
};


    return (
        <View style={styles.container}>
            <Text>Email</Text>
            <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
            />
            <Text>Password</Text>
            <TextInput
                style={styles.input}
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 12 }} />
            ) : (
                <Button
                    title="Submit"
                    onPress={handle_login}
        
                />
            )}

            <Text>Don't have an account?  
                <Link href="/signup">
                    <Text>  Sign Up</Text>
                </Link>
            </Text>
 
        </View>
    );
};

export default Login

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    input: {
    width: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 8,
    borderRadius: 4,
    },
    error: {
        color: 'red',
        marginVertical: 8,
        textAlign: 'center',
    },
});
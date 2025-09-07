import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { TextInput, Button, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Link } from 'expo-router';


const signup = () => {
     //signup page , signup form with name,email,password,confirm password,i want that the user will not be able to sned a signup request with empty fields, if any field is empty the signup button will be disabled and there will be a message near the button that all fields are required
      //i want the signup button will triggerer a post request to the backend with the form data to the endpoint http://127.0.0.1:8000/auth/signup/
      //after the request sent i want a loading animation until the response is received , if the request unsuccesfull i want to give the user an error message and to let him a try login again and , on successful request i want the page will only show coninue to login button that will navigate to login page
    const [username, setUsername] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState(false);
    const router = useRouter();

    const allFieldsFilled = username && email && password && confirmPassword;
    const passwordsMatch = password === confirmPassword;
    
    const handleSignup = () => {
        if (!allFieldsFilled) {
            setError('All fields are required.');
            return;
        }
        if (!passwordsMatch) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        fetch('http://192.168.1.144:8000/auth/signup', {   // no trailing slash needed
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password })
        })
        .then(async response => {
            const data = await response.json();
            setLoading(false);

            if (response.ok) {
                // ✅ Signup successful
                setSuccess(true);
            } else {
                // ❌ Backend returned error (like 400, 409, etc.)
                setError(data.detail || 'Signup failed. Please try again.');
            }
        })
        .catch(error => {
            setLoading(false);
            console.error('Network error:', error);
            setError('Network error. Please try again.');
        });
    };


    return (
        <View style={styles.container}>
            <Text>Signup</Text>
            <TextInput
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                editable={!loading && !success}
                style={styles.input}
            />
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                editable={!loading && !success}
                style={styles.input}
            />
            <TextInput
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading && !success}
                style={styles.input}
            />
            <TextInput
                placeholder="Confirm Password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading && !success}
                style={styles.input}
            />
            {allFieldsFilled && !passwordsMatch && !success && (
                <Text style={styles.error}>Passwords do not match</Text>
            )}
            {!success && (
                <Button
                    title="Signup"
                    onPress={handleSignup}
                />
            )}
            {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? (
                <Button title="Continue to Login" onPress={() => router.push('/login')} />
            ) : null}
            <Text>Return to 
               <Link href="/">
                    <Text style={styles.linkText}> Home</Text>
                </Link>
            </Text>
        </View>
    );
};

export default signup;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    input: {
        width: 200,
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 8,
        marginVertical: 8,
        borderRadius: 4,
    },
    requiredMsg: {
        color: 'orange',
        marginBottom: 8,
    },
    error: {
        color: 'red',
        marginVertical: 8,
        textAlign: 'center',
    },
});
import React, { useEffect } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { Link, useRouter } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { saveUserCredentials } from "../utils/auth";

const Home = () => {
  const router = useRouter();

  // Initialize Google login request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig.extra.googleClientId,
    redirectUri: makeRedirectUri({ useProxy: true }),
  });

  // Handle Google login response
  useEffect(() => {
    if (response?.type === "success") {
      (async () => {
        const { id_token } = response.authentication;

        try {
          // Send token to your backend
          const res = await fetch("http://192.168.1.144:8000/auth/login/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ google_token: id_token }),
          });

          const data = await res.json();

          if (res.ok && data.access_token && data.refresh_token) {
            // Save tokens securely
            await saveUserCredentials(data.access_token, data.refresh_token);

            console.log("✅ Logged in as:", data.user.username);

            // Navigate to feed
            router.replace("/feed");
          } else {
            console.error("❌ Google login failed:", data.detail || data);
          }
        } catch (err) {
          console.error("Network error:", err);
        }
      })();
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Jini App</Text>

      <View style={styles.buttonGroup}>
        <Link href="/login" style={styles.linkBtn}>
          <Text style={styles.linkText}>Login</Text>
        </Link>

        <Link href="/signup" style={styles.linkBtn}>
          <Text style={styles.linkText}>Sign Up</Text>
        </Link>

        <Button
          title="Login with Google"
          disabled={!request}
          onPress={() => promptAsync()}
        />
      </View>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
  },
  buttonGroup: {
    width: "80%",
    alignItems: "center",
    gap: 16,
  },
  linkBtn: {
    marginVertical: 8,
  },
  linkText: {
    fontSize: 18,
    color: "#007AFF",
  },
});

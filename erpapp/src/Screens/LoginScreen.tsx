import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { directus } from '../lib/directus';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await directus.login({ email, password });
      // After successful login, navigate to the Scan screen
      // navigation.replace('Scan');
      navigation.replace('WmsDashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.errors?.[0]?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ERP App</Text>
      <Text style={styles.subtitle}>Login with Directus</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#62788a"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#62788a"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0a0f16" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121b26',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'Archivo', fontSize: 34,
    fontWeight: '800',
    color: '#ecf1f4',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: 'Archivo', fontSize: 16,
    color: '#9db0bd',
    marginBottom: 40,
    textAlign: 'center',
  },
  errorText: {
    color: '#ffffff',
    backgroundColor: '#e0654f',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
    overflow: 'hidden',
  },
  input: {
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#283845',
    borderRadius: 14,
    padding: 16,
    fontFamily: 'Archivo', fontSize: 16,
    marginBottom: 16,
    color: '#ecf1f4',
    elevation: 1,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  button: {
    backgroundColor: '#3fbf75',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#3fbf75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#ecf1f4',
    fontFamily: 'Archivo', fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

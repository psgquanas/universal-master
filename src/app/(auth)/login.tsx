import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;

  const handleLogin = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const { error } = await signInWithEmail(email, password);
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not log in', error.message || 'Check your email and password and try again.');
      return;
    }
    router.replace('/(app)');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>UNIVERSAL CHAT</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in with the email and password you used to create your account.</Text>
        </View>

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.field}>
          <Mail size={19} color={theme.textSecondary} />
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
        </View>

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.field}>
          <Lock size={19} color={theme.textSecondary} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={theme.textSecondary} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="current-password" onSubmitEditing={handleLogin} />
          <TouchableOpacity onPress={() => setShowPassword((value) => !value)} hitSlop={8}>
            {showPassword ? <EyeOff size={19} color={theme.textSecondary} /> : <Eye size={19} color={theme.textSecondary} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.loginButton, !isValid && styles.disabled]} onPress={handleLogin} disabled={!isValid || submitting}>
          <Text style={styles.loginText}>{submitting ? 'Logging in...' : 'Log in'}</Text>
        </TouchableOpacity>

        <View style={styles.signupRow}>
          <Text style={styles.signupHint}>New to Universal Chat?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/phone')}><Text style={styles.signupLink}> Create account</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  header: { marginTop: Spacing.five, marginBottom: Spacing.five },
  eyebrow: { color: theme.primary, fontFamily: Fonts.sansBold, fontSize: 12, letterSpacing: 1.8, marginBottom: Spacing.two },
  title: { color: theme.text, fontFamily: Fonts.sansExtraBold, fontSize: 30, letterSpacing: -0.5 },
  subtitle: { color: theme.textSecondary, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, marginTop: Spacing.two },
  label: { color: theme.textSecondary, fontFamily: Fonts.sansBold, fontSize: 11, letterSpacing: 1, marginBottom: Spacing.two, marginLeft: Spacing.one },
  field: { height: 56, borderRadius: 16, backgroundColor: theme.backgroundElement, borderWidth: 1.5, borderColor: theme.backgroundSelected, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, marginBottom: Spacing.three },
  input: { flex: 1, height: '100%', color: theme.text, fontFamily: Fonts.sans, fontSize: 16 },
  loginButton: { height: 56, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  disabled: { opacity: 0.45 },
  loginText: { color: '#FFFFFF', fontFamily: Fonts.sansBold, fontSize: 16 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.four },
  signupHint: { color: theme.textSecondary, fontFamily: Fonts.sans, fontSize: 14 },
  signupLink: { color: theme.primary, fontFamily: Fonts.sansBold, fontSize: 14 },
});

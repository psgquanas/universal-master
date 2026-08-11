import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientWrapper } from '@/components/gradient-wrapper';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { resendEmailVerification, user, verifyEmailOtp } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (typeof params.email === 'string' ? params.email : user?.email ?? '').trim().toLowerCase();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [shake] = useState(() => new Animated.Value(0));

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH;

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([-1, 1, -1, 1, 0].map((toValue) =>
      Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true })
    )).start();
  };

  const changeDigit = (value: string, index: number) => {
    const clean = value.replace(/\D/g, '');
    setError(null);
    setStatus(null);

    if (clean.length > 1) {
      const next = Array(CODE_LENGTH).fill('');
      clean.slice(0, CODE_LENGTH).split('').forEach((digit, digitIndex) => { next[digitIndex] = digit; });
      setDigits(next);
      inputRefs.current[Math.min(clean.length, CODE_LENGTH) - 1]?.focus();
      return;
    }

    setDigits((current) => current.map((digit, digitIndex) => digitIndex === index ? clean : digit));
    if (clean && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const verifyEmail = async () => {
    if (!isComplete || verifying) return;
    if (!email) {
      setError('Your email address is missing. Return to sign up and try again.');
      return;
    }

    setVerifying(true);
    setError(null);
    const { verified, error: verifyError } = await verifyEmailOtp(email, code);
    setVerifying(false);

    if (verifyError || !verified) {
      setError(verifyError?.message || 'That verification code is incorrect or expired.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      runShake();
      return;
    }

    router.replace('/(auth)/profile');
  };

  const resendEmail = async () => {
    if (!email || resending) return;
    setResending(true);
    setError(null);
    setStatus(null);
    const { error: resendError } = await resendEmailVerification(email);
    setResending(false);

    if (resendError) {
      setError(resendError.message || 'Could not resend the verification email.');
      return;
    }

    setDigits(Array(CODE_LENGTH).fill(''));
    setStatus(`A new verification code was sent to ${email}.`);
  };

  const shakeTranslate = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.verificationPill}>
            <Mail size={15} color={theme.primary} />
            <Text style={styles.verificationPillText}>EMAIL VERIFICATION</Text>
          </View>

          <View style={styles.iconBadge}>
            <GradientWrapper colors={['#4361EE', '#7955D9']} style={styles.iconBadgeGradient}>
              <Mail size={27} color="#fff" />
            </GradientWrapper>
          </View>

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            Enter the six-digit verification code sent to {email || 'your email address'} to finish creating your account.
          </Text>

          <Text style={styles.inputLabel}>Verification code</Text>
          <Animated.View style={[styles.codeRow, { transform: [{ translateX: shakeTranslate }] }]}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                value={digit}
                onChangeText={(value) => changeDigit(value, index)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
                }}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                style={[styles.codeBox, digit ? styles.codeBoxFilled : null, error && styles.codeBoxError]}
                textAlign="center"
              />
            ))}
          </Animated.View>

          {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
          {status ? <Text selectable style={styles.successText}>{status}</Text> : null}

          <TouchableOpacity onPress={resendEmail} disabled={resending || !email} hitSlop={8}>
            <Text style={styles.resendText}>{resending ? 'Sending...' : 'Send a new code'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.verifyButton, !isComplete && styles.verifyButtonDisabled]}
            onPress={verifyEmail}
            activeOpacity={0.85}
            disabled={!isComplete || verifying}
          >
            <GradientWrapper colors={['#4361EE', '#7955D9']} style={styles.verifyGradient}>
              <Text style={styles.verifyText}>{verifying ? 'Verifying...' : 'Verify email'}</Text>
            </GradientWrapper>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: theme.background },
  content: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 34 : 28, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  verificationPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  verificationPillText: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 9.5, letterSpacing: 1.1 },
  iconBadge: { width: 64, height: 64, borderRadius: 21, overflow: 'hidden', marginBottom: 20 },
  iconBadgeGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 28, letterSpacing: -0.6 },
  subtitle: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 14, marginTop: 9, lineHeight: 21, maxWidth: '96%' },
  inputLabel: { color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 12.5, marginTop: 34 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  codeBox: { flex: 1, minWidth: 0, height: 60, borderRadius: 16, backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 22, borderWidth: 1.5, borderColor: 'transparent', fontVariant: ['tabular-nums'] },
  codeBoxFilled: { borderColor: theme.primary },
  codeBoxError: { borderColor: '#FF3B30' },
  errorText: { color: '#FF3B30', fontFamily: Fonts?.sansMedium, fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  successText: { color: '#22A35A', fontFamily: Fonts?.sansMedium, fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  resendText: { color: theme.primary, fontFamily: Fonts?.sansSemiBold, fontSize: 12.5, marginTop: 20 },
  verifyButton: { height: 56, borderRadius: 28, overflow: 'hidden', marginTop: 34 },
  verifyButtonDisabled: { opacity: 0.45 },
  verifyGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  verifyText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 15.5 },
});

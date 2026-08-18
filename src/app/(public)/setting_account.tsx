import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import {
    deleteCurrentAccount,
    getCurrentProfile,
    isValidInternationalPhone,
    normalizePhoneNumber,
    ProfileRecord,
    requestPhoneChangeEmailVerification,
    verifyPhoneChangeEmailCode,
} from '@/lib/profile';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, CheckCircle2, Mail, Phone, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PhoneChangeStep = 'number' | 'verification' | 'complete';

export default function SettingsAccountScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const [profile, setProfile] = useState<ProfileRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<PhoneChangeStep>('number');
    const [newNumber, setNewNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [destinationEmail, setDestinationEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let active = true;
        getCurrentProfile()
            .then((currentProfile) => { if (active) setProfile(currentProfile); })
            .catch((loadError) => {
                console.warn('[account] could not load profile', loadError);
                if (active) setError('Your account details could not be loaded.');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const normalizedNewNumber = normalizePhoneNumber(newNumber);
    const currentNumber = profile?.phone || '';
    const canRequestCode = isValidInternationalPhone(newNumber) && normalizedNewNumber !== currentNumber;
    const codeComplete = /^\d{6}$/.test(verificationCode);
    const compactLayout = width < 390;

    const sendVerificationCode = async () => {
        if (!canRequestCode || sending) return;
        setSending(true);
        setError(null);
        setStatus(null);
        try {
            const email = await requestPhoneChangeEmailVerification();
            setDestinationEmail(email);
            setVerificationCode('');
            setStep('verification');
            setStatus(`We sent a verification code to ${email}.`);
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'The verification email could not be sent.');
        } finally {
            setSending(false);
        }
    };

    const verifyAndChangeNumber = async () => {
        if (!codeComplete || verifying) return;
        setVerifying(true);
        setError(null);
        try {
            const updatedProfile = await verifyPhoneChangeEmailCode(verificationCode, normalizedNewNumber);
            setProfile(updatedProfile);
            setNewNumber('');
            setVerificationCode('');
            setStatus('Your email was verified and your phone number has been updated everywhere.');
            setStep('complete');
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : 'The code could not be verified.');
        } finally {
            setVerifying(false);
        }
    };

    const resetFlow = () => {
        setStep('number');
        setNewNumber('');
        setVerificationCode('');
        setError(null);
        setStatus(null);
    };

    const confirmDeleteAccount = () => {
        Alert.alert(
            'Delete your account?',
            'This permanently removes your profile, chats, posts, scheduled messages, and account data. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete permanently',
                    style: 'destructive',
                    onPress: async () => {
                        if (deleting) return;
                        setDeleting(true);
                        try {
                            await deleteCurrentAccount();
                            router.replace('/(auth)');
                        } catch (deleteError) {
                            setDeleting(false);
                            Alert.alert('Account not deleted', deleteError instanceof Error ? deleteError.message : 'Please try again.');
                        }
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Account & identity</Text>
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.contentContainer, { paddingHorizontal: width >= 700 ? 40 : 18 }]}
                >
                    <View style={styles.contentWidth}>
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ACCOUNT SECURITY</Text>
                        <View style={[styles.securityCard, { backgroundColor: theme.backgroundElement }]}>
                            <View style={[styles.securityIcon, { backgroundColor: `${theme.primary}18` }]}>
                                <ShieldCheck size={25} color={theme.primary} />
                            </View>
                            <View style={styles.securityCopy}>
                                <View style={styles.activeRow}>
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>Email two-step verification</Text>
                                    <View style={styles.activeBadge}>
                                        <Check size={12} color="#15803D" />
                                        <Text style={styles.activeText}>Active</Text>
                                    </View>
                                </View>
                                <Text selectable style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                                    Sensitive phone-number changes require a fresh code sent to {profile?.email || user?.email || 'your verified email'}.
                                </Text>
                            </View>
                        </View>

                        <Text style={[styles.sectionLabel, styles.changeLabel, { color: theme.textSecondary }]}>CHANGE PHONE NUMBER</Text>
                        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                            <View style={[styles.stepsRow, compactLayout && styles.stepsRowCompact]}>
                                <StepCard number="1" title="New number" active={step === 'number'} complete={step !== 'number'} theme={theme} />
                                <StepCard number="2" title="Email check" active={step === 'verification'} complete={step === 'complete'} theme={theme} />
                            </View>

                            {loading ? (
                                <View style={styles.loadingWrap}><ActivityIndicator color={theme.primary} /></View>
                            ) : step === 'number' ? (
                                <View>
                                    <View style={styles.changeNumberHeader}>
                                        <Phone size={20} color={theme.primary} />
                                        <Text style={[styles.cardTitle, { color: theme.text }]}>Choose your new number</Text>
                                    </View>
                                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                                        We will verify your identity by email before saving the change to your profile.
                                    </Text>

                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Current number</Text>
                                    <View style={[styles.readonlyField, { backgroundColor: theme.background }]}>
                                        <Text selectable style={[styles.readonlyText, { color: theme.text }]}>{currentNumber || 'Not set'}</Text>
                                        <CheckCircle2 size={17} color={theme.primary} />
                                    </View>

                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>New number</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: error ? '#EF4444' : theme.backgroundSelected }]}
                                        value={newNumber}
                                        onChangeText={(value) => { setNewNumber(value); setError(null); }}
                                        placeholder="+233 24 123 4567"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="phone-pad"
                                        autoComplete="tel"
                                        textContentType="telephoneNumber"
                                    />
                                    <Text style={[styles.helperText, { color: theme.textSecondary }]}>Include the country code, for example +233 or +1.</Text>

                                    <TouchableOpacity
                                        style={[styles.primaryButton, { backgroundColor: theme.primary }, !canRequestCode && styles.disabled]}
                                        activeOpacity={0.85}
                                        disabled={!canRequestCode || sending}
                                        onPress={sendVerificationCode}
                                    >
                                        {sending ? <ActivityIndicator size="small" color="#fff" /> : <Mail size={17} color="#fff" />}
                                        <Text style={styles.primaryButtonText}>{sending ? 'Sending code...' : 'Send email verification'}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : step === 'verification' ? (
                                <View>
                                    <View style={styles.changeNumberHeader}>
                                        <Mail size={20} color={theme.primary} />
                                        <Text style={[styles.cardTitle, { color: theme.text }]}>Check your email</Text>
                                    </View>
                                    <Text selectable style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                                        Enter the six-digit code sent to {destinationEmail || profile?.email || user?.email} to approve changing your number to {normalizedNewNumber}.
                                    </Text>

                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Verification code</Text>
                                    <TextInput
                                        autoFocus
                                        style={[styles.codeInput, { backgroundColor: theme.background, color: theme.text, borderColor: error ? '#EF4444' : theme.primary }]}
                                        value={verificationCode}
                                        onChangeText={(value) => { setVerificationCode(value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                                        placeholder="000000"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="number-pad"
                                        autoComplete="one-time-code"
                                        textContentType="oneTimeCode"
                                        maxLength={6}
                                    />

                                    <TouchableOpacity
                                        style={[styles.primaryButton, { backgroundColor: theme.primary }, !codeComplete && styles.disabled]}
                                        activeOpacity={0.85}
                                        disabled={!codeComplete || verifying}
                                        onPress={verifyAndChangeNumber}
                                    >
                                        {verifying ? <ActivityIndicator size="small" color="#fff" /> : <ShieldCheck size={18} color="#fff" />}
                                        <Text style={styles.primaryButtonText}>{verifying ? 'Verifying...' : 'Verify and change number'}</Text>
                                    </TouchableOpacity>

                                    <View style={styles.secondaryActions}>
                                        <TouchableOpacity onPress={sendVerificationCode} disabled={sending} style={styles.textAction}>
                                            <RefreshCw size={14} color={theme.primary} />
                                            <Text style={[styles.textActionLabel, { color: theme.primary }]}>{sending ? 'Sending...' : 'Send another code'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={resetFlow} style={styles.textAction}>
                                            <Text style={[styles.textActionLabel, { color: theme.textSecondary }]}>Use a different number</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.successWrap}>
                                    <View style={styles.successIcon}><CheckCircle2 size={34} color="#15803D" /></View>
                                    <Text style={[styles.successTitle, { color: theme.text }]}>Number updated securely</Text>
                                    <Text selectable style={[styles.successBody, { color: theme.textSecondary }]}>
                                        Your verified phone number is now {profile?.phone}. The change has been saved across Universal.
                                    </Text>
                                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={resetFlow}>
                                        <Text style={styles.primaryButtonText}>Change it again</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
                            {status && step !== 'complete' ? <Text selectable style={styles.statusText}>{status}</Text> : null}
                        </View>

                        <Text style={[styles.sectionLabel, styles.dangerLabel, { color: theme.textSecondary }]}>DANGER ZONE</Text>
                        <View style={[styles.dangerCard, { backgroundColor: theme.backgroundElement, borderColor: '#EF444455' }]}>
                            <View style={styles.dangerCopy}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Delete account</Text>
                                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Permanently delete your Universal Chat account and associated data.</Text>
                            </View>
                            <TouchableOpacity style={styles.deleteButton} disabled={deleting} onPress={confirmDeleteAccount}>
                                {deleting ? <ActivityIndicator size="small" color="#EF4444" /> : <Trash2 size={17} color="#EF4444" />}
                                <Text style={styles.deleteButtonText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function StepCard({ number, title, active, complete, theme }: { number: string; title: string; active: boolean; complete: boolean; theme: ReturnType<typeof useTheme> }) {
    return (
        <View style={[styles.stepCard, { borderColor: active ? theme.primary : complete ? '#22C55E80' : theme.backgroundSelected, backgroundColor: theme.background }]}>
            <View style={[styles.stepNumber, { backgroundColor: active ? theme.primary : complete ? '#22C55E' : theme.backgroundSelected }]}>
                {complete ? <Check size={13} color="#fff" /> : <Text style={[styles.stepNumberText, { color: active ? '#fff' : theme.textSecondary }]}>{number}</Text>}
            </View>
            <Text numberOfLines={1} style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 56, borderBottomWidth: StyleSheet.hairlineWidth },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: Fonts?.sansBold },
    headerSpacer: { width: 40 },
    contentContainer: { paddingTop: 22, paddingBottom: 48 },
    contentWidth: { width: '100%', maxWidth: 620, alignSelf: 'center' },
    sectionLabel: { fontSize: 11, fontFamily: Fonts?.sansBold, letterSpacing: 1.1, marginBottom: 9, marginLeft: 4 },
    changeLabel: { marginTop: 28 },
    dangerLabel: { marginTop: 28 },
    securityCard: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    securityIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    securityCopy: { flex: 1 },
    activeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    activeBadge: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
    activeText: { color: '#15803D', fontFamily: Fonts?.sansBold, fontSize: 10 },
    card: { borderRadius: 20, padding: 16 },
    cardTitle: { fontSize: 15, fontFamily: Fonts?.sansBold, flexShrink: 1 },
    cardSubtitle: { fontSize: 12.5, fontFamily: Fonts?.sans, lineHeight: 18, marginTop: 5 },
    stepsRow: { flexDirection: 'row', gap: 9, marginBottom: 24 },
    stepsRowCompact: { gap: 6 },
    stepCard: { flex: 1, minHeight: 52, borderRadius: 15, borderWidth: 1.5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepNumber: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    stepNumberText: { fontFamily: Fonts?.sansBold, fontSize: 11 },
    stepTitle: { flex: 1, fontFamily: Fonts?.sansSemiBold, fontSize: 11.5 },
    loadingWrap: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
    changeNumberHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    inputLabel: { fontSize: 11.5, fontFamily: Fonts?.sansBold, marginTop: 20, marginBottom: 7 },
    readonlyField: { height: 50, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    readonlyText: { fontSize: 15, fontFamily: Fonts?.sansMedium },
    input: { height: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 16, fontFamily: Fonts?.sans },
    helperText: { fontSize: 11.5, fontFamily: Fonts?.sans, marginTop: 7 },
    codeInput: { height: 62, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 27, letterSpacing: 10, textAlign: 'center', fontFamily: Fonts?.sansExtraBold, fontVariant: ['tabular-nums'] },
    primaryButton: { minHeight: 52, borderRadius: 26, marginTop: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    disabled: { opacity: 0.42 },
    primaryButtonText: { color: '#fff', fontSize: 14.5, fontFamily: Fonts?.sansBold },
    secondaryActions: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    textAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
    textActionLabel: { fontSize: 12.5, fontFamily: Fonts?.sansSemiBold },
    errorText: { color: '#EF4444', fontFamily: Fonts?.sansMedium, fontSize: 12.5, lineHeight: 18, marginTop: 15 },
    statusText: { color: '#15803D', fontFamily: Fonts?.sansMedium, fontSize: 12.5, lineHeight: 18, marginTop: 15 },
    successWrap: { alignItems: 'center', paddingVertical: 12 },
    successIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
    successTitle: { fontFamily: Fonts?.sansBold, fontSize: 19, marginTop: 14 },
    successBody: { fontFamily: Fonts?.sans, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
    dangerCard: { borderRadius: 20, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    dangerCopy: { flex: 1 },
    deleteButton: { minHeight: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EF444414' },
    deleteButtonText: { color: '#EF4444', fontFamily: Fonts?.sansBold, fontSize: 12.5 },
});

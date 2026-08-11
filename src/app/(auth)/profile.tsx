
import { GradientWrapper } from '@/components/gradient-wrapper';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentProfile, isUsernameAvailable, saveProfileDraft, uploadProfileAvatar } from '@/lib/profile';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CheckCircle2, MessageCircle, XCircle } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Simulated username availability — swap in a real API call when ready

// Universal Chat's signature "Aurora Signal" gradient — emerald → teal-cyan → signal blue → indigo.
// Used sparingly on hero brand moments (logo, primary CTA, camera badge, success state) to stay
// consistent with the rest of the app rather than the flat theme.primary fill.
const BRAND_GRADIENT = ['#0FBF8F', '#12A8B5', '#1C8FE0', '#4C5FFF'] as const;

type UsernameStatus = 'idle' | 'available' | 'taken';
type ThemeValue = ReturnType<typeof useTheme>;

function ProgressIndicator({ colors }: { colors: ThemeValue }) {
    return (
        <View style={styles.progressWrapper}>
            <View style={styles.progressRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={[styles.line, { backgroundColor: colors.primary }]} />
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={[styles.line, { backgroundColor: colors.backgroundSelected }]} />
                <View style={[styles.dotOutline, { borderColor: colors.backgroundSelected }]} />
            </View>
            <Text style={[styles.stepLabel, { color: colors.textSecondary, fontFamily: Fonts.sansMedium }]}>Profile Setup</Text>
        </View>
    );
}

function AvatarPicker({ colors, image, displayName, onPickImage }: { colors: ThemeValue; image: string | null; displayName: string; onPickImage: () => void }) {
    return (
        <View style={styles.avatarSection}>
            <TouchableOpacity onPress={onPickImage} activeOpacity={0.85} style={styles.avatarWrapper}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.avatarImage} />
                ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundElement, borderColor: colors.backgroundSelected }]}> 
                        <Text style={[styles.avatarInitials, { color: colors.textSecondary, fontFamily: Fonts.sansBold }]}> 
                            {displayName.trim() ? displayName.trim().split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase() : '?'}
                        </Text>
                    </View>
                )}
                <GradientWrapper
                    colors={BRAND_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cameraBadge}
                >
                    <Camera color="#fff" size={16} strokeWidth={2.5} />
                </GradientWrapper>
            </TouchableOpacity>
            <Text style={[styles.avatarLabel, { color: colors.textSecondary, fontFamily: Fonts.sans }]}>Add Profile Photo</Text>
            <Text style={[styles.avatarOptional, { color: colors.backgroundSelected, fontFamily: Fonts.sans }]}>Optional</Text>
        </View>
    );
}

function UsernameHelper({ colors, usernameStatus }: { colors: ThemeValue; usernameStatus: UsernameStatus }) {
    if (usernameStatus === 'available') {
        return (
            <View style={styles.statusRow}>
                <CheckCircle2 color="#22C55E" size={15} strokeWidth={2.5} />
                <Text style={[styles.statusText, { color: '#22C55E', fontFamily: Fonts.sansMedium }]}>Available</Text>
            </View>
        );
    }
    if (usernameStatus === 'taken') {
        return (
            <View style={styles.statusRow}>
                <XCircle color="#EF4444" size={15} strokeWidth={2.5} />
                <Text style={[styles.statusText, { color: '#EF4444', fontFamily: Fonts.sansMedium }]}>Already taken</Text>
            </View>
        );
    }
    return <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: Fonts.sans }]}>This is how people can find you.</Text>;
}

function SuccessOverlay({
    visible,
    colors,
    scaleAnim,
}: {
    visible: boolean;
    colors: ThemeValue;
    scaleAnim: Animated.Value;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.successBackdrop}>
                <Animated.View
                    style={[
                        styles.successCard,
                        { backgroundColor: colors.background, transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <GradientWrapper
                        colors={BRAND_GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.successIconRing}
                    >
                        <CheckCircle2 color="#fff" size={40} strokeWidth={2.4} />
                    </GradientWrapper>
                    <Text style={[styles.successTitle, { color: colors.text, fontFamily: Fonts.sansBold }]}>
                        You&apos;re all set!
                    </Text>
                    <Text style={[styles.successSubtitle, { color: colors.textSecondary, fontFamily: Fonts.sans }]}>
                        Redirecting you to Universal Chat...
                    </Text>
                    <ActivityIndicator style={styles.successSpinner} color={colors.primary} />
                </Animated.View>
            </View>
        </Modal>
    );
}

export default function ProfileScreen() {
    const router = useRouter();
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const colors = useTheme();

    const [image, setImage] = useState<string | null>(null);
    const [imageMimeType, setImageMimeType] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [about, setAbout] = useState('');
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Success confirmation shown after tapping Continue, before navigating on.
    const [showSuccess, setShowSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successScale] = useState(() => new Animated.Value(0.6));
    const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ABOUT_LIMIT = 120;
    const isValid = displayName.trim().length > 0 && usernameStatus === 'available';

    useEffect(() => {
        let active = true;

        const loadProfile = async () => {
            try {
                const profile = await getCurrentProfile();
                if (!active) return;

                if (profile?.full_name) {
                    setDisplayName(profile.full_name);
                }
                if (profile?.username) {
                    setUsername(profile.username);
                    setUsernameStatus('available');
                }
                if (profile?.bio_status) {
                    setAbout(profile.bio_status);
                }
                if (profile?.avatar_url) {
                    setImage(profile.avatar_url);
                }
            } catch (error) {
                console.warn('[profile] could not load saved profile', error);
            }
        };

        loadProfile();

        return () => {
            active = false;
        };
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setImageMimeType(result.assets[0].mimeType ?? 'image/jpeg');
        }
    };

    const handleUsernameChange = (value: string) => {
        // Sanitise: lowercase letters, digits, underscore only
        const sanitised = value.replace(/[^a-z0-9_]/gi, '').toLowerCase();
        setUsername(sanitised);

        if (usernameTimer.current) clearTimeout(usernameTimer.current);

        if (sanitised.length === 0) {
            setUsernameStatus('idle');
            return;
        }

        // Debounce the lookup by 500 ms
        usernameTimer.current = setTimeout(async () => {
            try {
                setUsernameStatus(await isUsernameAvailable(sanitised) ? 'available' : 'taken');
            } catch (error) {
                console.warn('[profile] username lookup failed', error);
                setUsernameStatus('idle');
            }
        }, 500);
    };

    const handleContinue = async () => {
        if (!isValid || submitting) return;

        setSubmitting(true);

        try {
            const avatarUrl = image && imageMimeType ? await uploadProfileAvatar(image, imageMimeType) : image;
            await saveProfileDraft({
                fullName: displayName.trim(),
                username,
                about: about.trim() || null,
                avatarUrl,
            });

            setShowSuccess(true);
            successScale.setValue(0.6);
            Animated.spring(successScale, {
                toValue: 1,
                friction: 6,
                tension: 80,
                useNativeDriver: true,
            }).start();

            if (navigateTimer.current) clearTimeout(navigateTimer.current);
            navigateTimer.current = setTimeout(() => {
                router.replace(mode === 'edit' ? '/(public)/profile' : '/(app)');
            }, 1400);
        } catch (error) {
            console.warn('[profile] could not save profile', error);
            Alert.alert('Could not save profile', 'Please try again in a moment.');
            setSubmitting(false);
        }
    };

    const handleSkipPhoto = () => {
        // Skips only the photo — name + username must already be valid
        if (isValid) handleContinue();
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Progress */}
                    <ProgressIndicator colors={colors} />

                    {/* Logo */}
                    <View style={styles.logoWrapper}>
                        <GradientWrapper
                            colors={BRAND_GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoBox}
                        >
                            <MessageCircle color="#fff" size={34} strokeWidth={2} />
                        </GradientWrapper>
                        <Text style={[styles.appName, { color: colors.primary, fontFamily: Fonts.sansBold }]}>
                            UNIVERSAL CHAT
                        </Text>
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.sansBold }]}>
                            Create your profile
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: Fonts.sans }]}>
                            Tell everyone who you are. You can update this information anytime.
                        </Text>
                    </View>

                    {/* Avatar */}
                    <AvatarPicker colors={colors} image={image} displayName={displayName} onPickImage={pickImage} />

                    {/* Display Name */}
                    <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.sansBold }]}>
                            DISPLAY NAME
                        </Text>
                        <View style={[
                            styles.inputWrapper,
                            {
                                borderColor: displayName.length > 0 ? colors.primary + '60' : colors.backgroundSelected,
                                backgroundColor: colors.backgroundElement,
                            }
                        ]}>
                            <TextInput
                                style={[styles.input, { color: colors.text, fontFamily: Fonts.sans }]}
                                placeholder="Enter your full name"
                                placeholderTextColor={colors.textSecondary}
                                value={displayName}
                                onChangeText={setDisplayName}
                                returnKeyType="next"
                            />
                        </View>
                    </View>

                    {/* Username */}
                    <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.sansBold }]}>
                            USERNAME
                        </Text>
                        <View style={[
                            styles.inputWrapper,
                            {
                                borderColor: usernameStatus === 'available'
                                    ? '#22C55E60'
                                    : usernameStatus === 'taken'
                                        ? '#EF444460'
                                        : colors.backgroundSelected,
                                backgroundColor: colors.backgroundElement,
                            }
                        ]}>
                            <Text style={[styles.atSign, { color: colors.primary, fontFamily: Fonts.sansBold }]}>
                                @
                            </Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, fontFamily: Fonts.sans }]}
                                placeholder="username"
                                placeholderTextColor={colors.textSecondary}
                                value={username}
                                onChangeText={handleUsernameChange}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="next"
                            />
                        </View>
                        <View style={styles.usernameHelper}>
                            <UsernameHelper colors={colors} usernameStatus={usernameStatus} />
                        </View>
                    </View>

                    {/* About */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.labelRow}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.sansBold }]}>
                                ABOUT
                            </Text>
                            <Text style={[styles.labelOptional, { color: colors.backgroundSelected, fontFamily: Fonts.sans }]}>
                                Optional
                            </Text>
                        </View>
                        <View style={[
                            styles.textAreaWrapper,
                            {
                                borderColor: about.length > 0 ? colors.primary + '60' : colors.backgroundSelected,
                                backgroundColor: colors.backgroundElement,
                            }
                        ]}>
                            <TextInput
                                style={[styles.textArea, { color: colors.text, fontFamily: Fonts.sans }]}
                                placeholder="Tell people a little about yourself..."
                                placeholderTextColor={colors.textSecondary}
                                value={about}
                                onChangeText={(t) => setAbout(t.slice(0, ABOUT_LIMIT))}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                returnKeyType="done"
                            />
                        </View>
                        <Text style={[
                            styles.charCount,
                            {
                                color: about.length >= ABOUT_LIMIT ? '#EF4444' : colors.textSecondary,
                                fontFamily: Fonts.sans,
                            }
                        ]}>
                            {about.length}/{ABOUT_LIMIT}
                        </Text>
                    </View>

                    {/* Continue button */}
                    <TouchableOpacity
                        style={[
                            styles.buttonWrapper,
                            !isValid && styles.buttonWrapperDisabled,
                        ]}
                        disabled={!isValid || submitting}
                        onPress={handleContinue}
                        activeOpacity={0.85}
                    >
                        {isValid ? (
                            <GradientWrapper
                                colors={BRAND_GRADIENT}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.button}
                            >
                                <Text style={[styles.buttonText, { color: '#FFF', fontFamily: Fonts.sansMedium }]}>
                                    Continue
                                </Text>
                            </GradientWrapper>
                        ) : (
                            <View style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
                                <Text style={[styles.buttonText, { color: colors.textSecondary, fontFamily: Fonts.sansMedium }]}>
                                    Continue
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Skip photo */}
                    <TouchableOpacity
                        onPress={handleSkipPhoto}
                        disabled={!isValid || submitting}
                        style={styles.skipButton}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.skipText,
                            {
                                color: isValid ? colors.primary : colors.backgroundSelected,
                                fontFamily: Fonts.sans,
                            }
                        ]}>
                            Skip photo for now
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <SuccessOverlay visible={showSuccess} colors={colors} scaleAnim={successScale} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // Layout
    safeArea: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
        paddingBottom: Spacing.five,
    },

    // Progress
    progressWrapper: {
        alignItems: 'center',
        marginBottom: Spacing.four,
        gap: Spacing.two,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotOutline: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    line: {
        width: 32,
        height: 2,
        borderRadius: 1,
    },
    stepLabel: {
        fontSize: 12,
        letterSpacing: 0.5,
    },

    // Logo / Header
    logoWrapper: {
        alignItems: 'center',
        marginBottom: Spacing.three,
        gap: Spacing.two,
    },
    logoBox: {
        width: 72,
        height: 72,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appName: {
        fontSize: 13,
        letterSpacing: 2,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.four,
    },
    title: {
        fontSize: 26,
        marginBottom: Spacing.two,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.two,
    },

    // Avatar
    avatarSection: {
        alignItems: 'center',
        marginBottom: Spacing.four,
    },
    avatarWrapper: {
        marginBottom: Spacing.two,
        position: 'relative',
    },
    avatarPlaceholder: {
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 112,
        height: 112,
        borderRadius: 56,
    },
    avatarInitials: {
        fontSize: 36,
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    avatarLabel: {
        fontSize: 14,
        marginTop: Spacing.one,
    },
    avatarOptional: {
        fontSize: 12,
        marginTop: 2,
    },

    // Fields
    fieldGroup: {
        marginBottom: Spacing.three,
    },
    label: {
        fontSize: 11,
        letterSpacing: 1,
        marginBottom: Spacing.two,
        marginLeft: Spacing.one,
        textTransform: 'uppercase',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.two,
        marginLeft: Spacing.one,
        marginRight: Spacing.one,
    },
    labelOptional: {
        fontSize: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1.5,
        borderRadius: 16,
        paddingHorizontal: Spacing.three,
    },
    atSign: {
        fontSize: 18,
        marginRight: 2,
    },
    input: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    textAreaWrapper: {
        borderWidth: 1.5,
        borderRadius: 16,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        minHeight: 96,
    },
    textArea: {
        fontSize: 15,
        lineHeight: 22,
        minHeight: 72,
    },
    usernameHelper: {
        marginTop: Spacing.one,
        marginLeft: Spacing.one,
        minHeight: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statusText: {
        fontSize: 13,
    },
    helperText: {
        fontSize: 13,
    },
    charCount: {
        fontSize: 12,
        textAlign: 'right',
        marginTop: 6,
        marginRight: Spacing.one,
    },

    // Actions
    buttonWrapper: {
        borderRadius: 16,
        marginTop: Spacing.two,
        marginBottom: Spacing.two,
        shadowColor: '#12A8B5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 6,
    },
    buttonWrapperDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 18,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: Spacing.two,
    },
    skipText: {
        fontSize: 14,
        textDecorationLine: 'underline',
    },

    // Success overlay
    successBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(10,12,16,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.four,
    },
    successCard: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 24,
        paddingVertical: Spacing.five,
        paddingHorizontal: Spacing.four,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 12,
    },
    successIconRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.three,
    },
    successTitle: {
        fontSize: 20,
        marginBottom: Spacing.one,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
    successSpinner: {
        marginTop: Spacing.two,
    },
});

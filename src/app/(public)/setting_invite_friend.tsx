import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Check, Copy, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsInviteFriendScreen() {
    const theme = useTheme();
    const router = useRouter();

    const [copied, setCopied] = useState(false);

    // Generate a stable invite link once on mount using useState initializer
    const [inviteLink] = useState(() =>
        Linking.createURL('/invite', {
            queryParams: { ref: 'user_' + Math.random().toString(36).substring(2, 8) },
        })
    );

    const handleCopyLink = async () => {
        try {
            await Share.share({
                message: inviteLink,
                title: 'Invite Link',
            });
        } catch {
            Alert.alert('Copy Link', inviteLink);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Hey! Join me on the app. Use this link to sign up: ${inviteLink}`,
                title: 'Invite a Friend',
                url: inviteLink,
            });
        } catch {
            // User cancelled the share dialog
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Invite a Friend</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.heroSection}>
                    <View style={[styles.heroIconWrap, { backgroundColor: theme.backgroundElement }]}>
                        <Users size={40} color={theme.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>Invite your friends</Text>
                    <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                        Share your personal invite link and start connecting with friends on the app.
                    </Text>
                </View>

                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR INVITE LINK</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.linkBox, { backgroundColor: theme.background }]}>
                        <Text style={[styles.linkText, { color: theme.text }]} numberOfLines={1}>
                            {inviteLink}
                        </Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                        activeOpacity={0.85}
                        onPress={handleCopyLink}
                    >
                        {copied ? (
                            <Check size={18} color="#fff" />
                        ) : (
                            <Copy size={18} color="#fff" />
                        )}
                        <Text style={styles.actionBtnText}>
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.primary }]}
                        activeOpacity={0.85}
                        onPress={handleShare}
                    >
                        <Share2 size={18} color={theme.primary} />
                        <Text style={[styles.actionBtnText, { color: theme.primary }]}>Share</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                    Your friends will be able to join the app using this link. You&apos;ll both get notified when they sign up.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        height: 56,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts?.sansBold,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 18,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    heroIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 20,
        fontFamily: Fonts?.sansBold,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    sectionLabel: {
        fontSize: 12,
        fontFamily: Fonts?.sansMedium,
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        padding: 14,
    },
    linkBox: {
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        justifyContent: 'center',
    },
    linkText: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    actionBtn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionBtnText: {
        fontSize: 15,
        fontFamily: Fonts?.sansBold,
        color: '#fff',
    },
    footerText: {
        fontSize: 13,
        fontFamily: Fonts?.sans,
        textAlign: 'center',
        lineHeight: 18,
        marginTop: 24,
        paddingHorizontal: 10,
    },
});

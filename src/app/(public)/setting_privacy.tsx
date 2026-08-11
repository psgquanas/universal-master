import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, FileText, ShieldOff, UserX } from 'lucide-react-native';
import { useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type BlockedContact = {
    id: string;
    name: string;
    avatar?: string;
};

const INITIAL_BLOCKED: BlockedContact[] = [
    { id: '1', name: 'Daniel Owusu' },
    { id: '2', name: 'Ama Serwaa' },
    { id: '3', name: 'Kwame Asante' },
];

const TERMS_TEXT = `1. Acceptance of Terms
By using this app, you agree to be bound by these Terms and Conditions. If you do not agree, please discontinue use of the app.

2. Use of the Service
You agree to use the app only for lawful purposes and in a manner that does not infringe the rights of, or restrict or inhibit the use and enjoyment of the app by, any third party.

3. Privacy
Your use of the app is also governed by our Privacy Policy, which explains how we collect, use, and protect your information.

4. Account Responsibility
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

5. Changes to Terms
We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms.

6. Termination
We reserve the right to suspend or terminate access to the app for any user who violates these Terms.

7. Limitation of Liability
The app is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the app.

8. Contact
If you have questions about these Terms, please reach out through the app's support channel.`;

export default function SettingsPrivacyScreen() {
    const theme = useTheme();
    const router = useRouter();

    const [blockedContacts, setBlockedContacts] = useState<BlockedContact[]>(INITIAL_BLOCKED);
    const [showTerms, setShowTerms] = useState(false);
    const [confirmUnblockId, setConfirmUnblockId] = useState<string | null>(null);

    const handleUnblock = (id: string) => {
        setBlockedContacts((prev) => prev.filter((c) => c.id !== id));
        setConfirmUnblockId(null);
    };

    const contactToUnblock = blockedContacts.find((c) => c.id === confirmUnblockId);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Blocked Contacts Section */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                    BLOCKED CONTACTS
                </Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    {blockedContacts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <ShieldOff size={28} color={theme.textSecondary} strokeWidth={1.5} />
                            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                                You haven&apos;t blocked anyone
                            </Text>
                        </View>
                    ) : (
                        blockedContacts.map((contact, index) => (
                            <View key={contact.id}>
                                <View style={styles.contactRow}>
                                    <View style={styles.contactLeft}>
                                        {contact.avatar ? (
                                            <Image source={{ uri: contact.avatar }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatarFallback, { backgroundColor: theme.background }]}>
                                                <Text style={[styles.avatarFallbackText, { color: theme.textSecondary }]}>
                                                    {contact.name.charAt(0)}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={[styles.contactName, { color: theme.text }]}>{contact.name}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.unblockBtn, { borderColor: theme.primary }]}
                                        activeOpacity={0.7}
                                        onPress={() => setConfirmUnblockId(contact.id)}
                                    >
                                        <Text style={[styles.unblockBtnText, { color: theme.primary }]}>Unblock</Text>
                                    </TouchableOpacity>
                                </View>
                                {index < blockedContacts.length - 1 && (
                                    <View style={[styles.divider, { backgroundColor: theme.background }]} />
                                )}
                            </View>
                        ))
                    )}
                </View>

                {/* Terms and Conditions Section */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 28 }]}>
                    LEGAL
                </Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <TouchableOpacity
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => setShowTerms(true)}
                    >
                        <View style={styles.rowLeft}>
                            <FileText size={20} color={theme.primary} />
                            <Text style={[styles.rowTitle, { color: theme.text }]}>Terms and Conditions</Text>
                        </View>
                        <ChevronRight size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Terms and Conditions Modal */}
            <Modal
                visible={showTerms}
                animationType="slide"
                onRequestClose={() => setShowTerms(false)}
            >
                <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
                    <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                        <TouchableOpacity onPress={() => setShowTerms(false)} style={styles.backButton}>
                            <ArrowLeft size={22} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Terms and Conditions</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <ScrollView contentContainerStyle={styles.termsContent}>
                        <Text style={[styles.termsText, { color: theme.text }]}>{TERMS_TEXT}</Text>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Confirm Unblock Modal */}
            <Modal
                visible={!!confirmUnblockId}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmUnblockId(null)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setConfirmUnblockId(null)} />
                    <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
                        <View style={[styles.modalIconWrap, { backgroundColor: theme.backgroundElement }]}>
                            <UserX size={26} color={theme.primary} />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            Unblock {contactToUnblock?.name}?
                        </Text>
                        <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
                            They will be able to message and call you again.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.backgroundElement }]}
                                onPress={() => setConfirmUnblockId(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={() => confirmUnblockId && handleUnblock(confirmUnblockId)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Unblock</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    sectionLabel: {
        fontSize: 12,
        fontFamily: Fonts?.sansMedium,
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        padding: 6,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    contactLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    avatarFallback: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: {
        fontSize: 16,
        fontFamily: Fonts?.sansBold,
    },
    contactName: {
        fontSize: 15,
        fontFamily: Fonts?.sansMedium,
        flexShrink: 1,
    },
    unblockBtn: {
        paddingHorizontal: 14,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unblockBtnText: {
        fontSize: 12,
        fontFamily: Fonts?.sansBold,
    },
    divider: {
        height: 1,
        marginHorizontal: 10,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 10,
    },
    emptyStateText: {
        fontSize: 13,
        fontFamily: Fonts?.sans,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowTitle: {
        fontSize: 15,
        fontFamily: Fonts?.sansMedium,
    },
    termsContent: {
        padding: 20,
    },
    termsText: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCard: {
        width: '85%',
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
    },
    modalIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: Fonts?.sansBold,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalBody: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 22,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnText: {
        fontSize: 14,
        fontFamily: Fonts?.sansBold,
    },
});
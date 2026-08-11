import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, HelpCircle, Mail, Shield } from 'lucide-react-native';
import { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIVACY_POLICY_TEXT = `1. Information We Collect
We collect information you provide directly, such as your name, email address, phone number, and any content you create or share within the app.

2. How We Use Your Information
We use the information we collect to operate and improve our services, to send you notifications, and to communicate with you about updates or offers.

3. Sharing of Information
We do not sell your personal information. We may share data with service providers who assist in operating the app, subject to confidentiality agreements.

4. Data Security
We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, or destruction.

5. Your Rights
You can access, update, or delete your personal information at any time through your account settings.

6. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy within the app.

7. Contact Us
If you have any questions about this Privacy Policy, please contact us through the app's support channel.`;

const HELP_CENTER_ITEMS = [
    {
        id: 'faq',
        title: 'Frequently Asked Questions',
        subtitle: 'Find answers to common questions',
    },
    {
        id: 'getting-started',
        title: 'Getting Started',
        subtitle: 'Learn how to use the app',
    },
    {
        id: 'account',
        title: 'Account & Security',
        subtitle: 'Manage your account settings',
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        subtitle: 'Fix common issues',
    },
];

export default function SettingsHelpScreen() {
    const theme = useTheme();
    const router = useRouter();

    const [showPrivacy, setShowPrivacy] = useState(false);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Help</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Help Center Section */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>HELP CENTER</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    {HELP_CENTER_ITEMS.map((item, index) => (
                        <View key={item.id}>
                            <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                                <View style={styles.rowLeft}>
                                    <HelpCircle size={20} color={theme.primary} />
                                    <View style={styles.rowTextWrap}>
                                        <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                                        <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                                            {item.subtitle}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                            {index < HELP_CENTER_ITEMS.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: theme.background }]} />
                            )}
                        </View>
                    ))}
                </View>

                {/* Contact Us Section */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 28 }]}>SUPPORT</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                        <View style={styles.rowLeft}>
                            <Mail size={20} color={theme.primary} />
                            <View style={styles.rowTextWrap}>
                                <Text style={[styles.rowTitle, { color: theme.text }]}>Contact Us</Text>
                                <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                                    Get in touch with our support team
                                </Text>
                            </View>
                        </View>
                        <ChevronRight size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Privacy Policy Section */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 28 }]}>LEGAL</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setShowPrivacy(true)}>
                        <View style={styles.rowLeft}>
                            <Shield size={20} color={theme.primary} />
                            <View style={styles.rowTextWrap}>
                                <Text style={[styles.rowTitle, { color: theme.text }]}>Privacy Policy</Text>
                                <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                                    How we collect and protect your data
                                </Text>
                            </View>
                        </View>
                        <ChevronRight size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Privacy Policy Modal */}
            <Modal
                visible={showPrivacy}
                animationType="slide"
                onRequestClose={() => setShowPrivacy(false)}
            >
                <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
                    <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                        <TouchableOpacity onPress={() => setShowPrivacy(false)} style={styles.backButton}>
                            <ArrowLeft size={22} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy Policy</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <ScrollView contentContainerStyle={styles.termsContent}>
                        <Text style={[styles.termsText, { color: theme.text }]}>{PRIVACY_POLICY_TEXT}</Text>
                    </ScrollView>
                </SafeAreaView>
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        gap: 12,
        paddingRight: 12,
    },
    rowTextWrap: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 15,
        fontFamily: Fonts?.sansMedium,
        marginBottom: 2,
    },
    rowSubtitle: {
        fontSize: 12,
        fontFamily: Fonts?.sans,
        lineHeight: 16,
    },
    divider: {
        height: 1,
        marginHorizontal: 10,
    },
    termsContent: {
        padding: 20,
    },
    termsText: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
        lineHeight: 22,
    },
});

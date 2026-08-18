import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import {
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
If you have questions about this Privacy Policy, use the support contact shown on the app's store listing.`;

export default function SettingsHelpScreen() {
    const theme = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy Policy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIVACY POLICY</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.termsText, { color: theme.text }]}>{PRIVACY_POLICY_TEXT}</Text>
                </View>
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
    sectionLabel: {
        fontSize: 12,
        fontFamily: Fonts?.sansMedium,
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        padding: 20,
    },
    termsText: {
        fontSize: 14,
        fontFamily: Fonts?.sans,
        lineHeight: 22,
    },
});

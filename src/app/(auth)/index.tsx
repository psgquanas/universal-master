import { Fonts, Spacing } from '@/constants/theme';
import { useThemeContext } from '@/context/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowRight, Globe, Moon, Sun } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
    const router = useRouter();
    const colors = useTheme();
    const { setTheme, colorScheme } = useThemeContext();
    const isDark = colorScheme === 'dark';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

            {/* Top bar with theme toggle */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={[styles.themeToggle, { backgroundColor: colors.backgroundElement, borderColor: colors.backgroundSelected }]}
                    onPress={() => setTheme(isDark ? 'light' : 'dark')}
                    activeOpacity={0.8}
                >
                    {isDark
                        ? <Sun size={20} color={colors.primary} strokeWidth={2} />
                        : <Moon size={20} color={colors.primary} strokeWidth={2} />
                    }
                    <View style={[styles.toggleTrack, { backgroundColor: colors.backgroundSelected }]}>
                        <View style={[
                            styles.toggleThumb,
                            { backgroundColor: colors.primary, transform: [{ translateX: isDark ? 14 : 0 }] }
                        ]} />
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.backgroundElement }]}>
                    <Globe size={108} color={colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>Universal Chat</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Connect securely across every device</Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)/phone')}>
                    <Text style={styles.primaryButtonText}>Create account</Text>
                    <ArrowRight color="#FFFFFF" size={20} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={() => router.push('/(auth)/login')}>
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Log in</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.four,
    },
    topBar: {
        width: '100%',
        alignItems: 'flex-end',
        paddingTop: Spacing.two,
    },
    themeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    toggleTrack: {
        width: 36,
        height: 20,
        borderRadius: 10,
        padding: 3,
        justifyContent: 'center',
    },
    toggleThumb: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 180,
        height: 180,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.four,
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 10,
        fontFamily: Fonts.sansBold,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center',
        maxWidth: 260,
        fontFamily: Fonts.sans,
    },
    actions: { width: '100%', gap: Spacing.two, marginBottom: Spacing.four },
    primaryButton: {
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButtonText: { color: '#FFFFFF', fontFamily: Fonts.sansBold, fontSize: 16 },
    secondaryButton: { height: 56, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    secondaryButtonText: { fontFamily: Fonts.sansBold, fontSize: 16 },
});

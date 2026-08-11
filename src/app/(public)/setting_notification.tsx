import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, Phone, Users, Volume2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsNotificationsScreen() {
    const theme = useTheme();
    const router = useRouter();

    // Message notifications
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [messageTone, setMessageTone] = useState(true);

    // Group notifications
    const [groupNotifications, setGroupNotifications] = useState(true);
    const [groupTone, setGroupTone] = useState(true);

    // Call notifications
    const [callNotifications, setCallNotifications] = useState(true);
    const [callTone, setCallTone] = useState(true);

    const renderToggleRow = (
        icon: React.ReactNode,
        title: string,
        subtitle: string,
        value: boolean,
        onValueChange: (val: boolean) => void
    ) => (
        <View style={styles.row}>
            <View style={styles.rowLeft}>
                {icon}
                <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: theme.backgroundElement, true: theme.primary }}
                thumbColor="#fff"
            />
        </View>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Message Notifications */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>MESSAGES</Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    {renderToggleRow(
                        <MessageCircle size={20} color={theme.primary} />,
                        'Message notifications',
                        'Show notifications for new messages',
                        messageNotifications,
                        setMessageNotifications
                    )}
                    <View style={[styles.divider, { backgroundColor: theme.background }]} />
                    {renderToggleRow(
                        <Volume2 size={20} color={theme.primary} />,
                        'Tone',
                        'Play a sound for new messages',
                        messageTone,
                        setMessageTone
                    )}
                </View>

                {/* Group Notifications */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 28 }]}>
                    GROUPS
                </Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    {renderToggleRow(
                        <Users size={20} color={theme.primary} />,
                        'Group notifications',
                        'Show notifications for group messages',
                        groupNotifications,
                        setGroupNotifications
                    )}
                    <View style={[styles.divider, { backgroundColor: theme.background }]} />
                    {renderToggleRow(
                        <Volume2 size={20} color={theme.primary} />,
                        'Tone',
                        'Play a sound for group messages',
                        groupTone,
                        setGroupTone
                    )}
                </View>

                {/* Call Notifications */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 28 }]}>
                    CALLS
                </Text>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    {renderToggleRow(
                        <Phone size={20} color={theme.primary} />,
                        'Call notifications',
                        'Show notifications for incoming calls',
                        callNotifications,
                        setCallNotifications
                    )}
                    <View style={[styles.divider, { backgroundColor: theme.background }]} />
                    {renderToggleRow(
                        <Volume2 size={20} color={theme.primary} />,
                        'Tone',
                        'Play a ringtone for incoming calls',
                        callTone,
                        setCallTone
                    )}
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
        padding: 14,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
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
        marginVertical: 4,
    },
});
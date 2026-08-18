import { useFocusEffect } from 'expo-router';
import { Bell, Heart, MessageCircle, UserPlus, Share2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomTabInset, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getNotifications, markNotificationsRead, respondToFriendRequest } from '@/lib/social';
import { supabase } from '@/lib/supabase';

type NotificationRecord = {
  id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
  actor?: { full_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
  friend_request?: { id: string; status: 'pending' | 'accepted' | 'declined'; sender_id: string; recipient_id: string } | null;
};

const timeAgo = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};

function notificationIcon(type: string, color: string) {
  if (type.includes('friend')) return <UserPlus size={20} color={color} />;
  if (type.includes('comment')) return <MessageCircle size={20} color={color} />;
  if (type.includes('share')) return <Share2 size={20} color={color} />;
  return <Heart size={20} color={color} />;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const rows = await getNotifications();
      setNotifications(rows as NotificationRecord[]);
    } catch (error) {
      console.warn('[notifications] load failed', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useFocusEffect(useCallback(() => {
    const channel = supabase.channel('notifications-screen').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]));

  const markAllAsRead = async () => {
    try {
      await markNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    } catch (error) {
      console.warn('[notifications] mark all as read failed', error);
    }
  };

  const respond = async (notificationId: string, requestId: string, action: 'accepted' | 'declined') => {
    try {
      await respondToFriendRequest(requestId, action);
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.id === notificationId
        ? { ...item, read_at: readAt, friend_request: item.friend_request ? { ...item.friend_request, status: action } : null }
        : item));
    } catch (error) {
      console.warn('[notifications] friend request response failed', error);
      void load();
    }
  };

  const hasUnread = notifications.some((item) => !item.read_at);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.primary} />}
        ListHeaderComponent={<><View style={styles.header}><View><Text style={styles.eyebrow}>UNIVERSAL</Text><Text style={styles.title}>Notifications</Text></View><View style={styles.headerIcon}><Bell size={20} color={theme.primary} /></View></View>{hasUnread ? <TouchableOpacity style={styles.markAllButton} onPress={() => { void markAllAsRead(); }}><Text style={styles.markAllText}>Mark all as read</Text></TouchableOpacity> : null}</>}
        ListEmptyComponent={loading ? <ActivityIndicator color={theme.primary} style={styles.empty} /> : <View style={styles.empty}><Bell size={28} color={theme.textSecondary} /><Text style={styles.emptyTitle}>You’re all caught up</Text><Text style={styles.emptyText}>New likes, comments, shares and connection updates will appear here.</Text></View>}
        renderItem={({ item }) => {
          const actorName = item.actor?.full_name || item.actor?.username || 'Someone';
          const pendingRequest = item.type === 'friend_request' && item.friend_request?.status === 'pending';
          return <TouchableOpacity style={[styles.row, !item.read_at && styles.unread]} onPress={() => { void markNotificationsRead([item.id]); setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)); }}>
            <View style={styles.avatar}>{item.actor?.avatar_url ? <Image source={{ uri: item.actor.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{actorName.slice(0, 1).toUpperCase()}</Text>}</View>
            <View style={styles.copy}><Text style={styles.message}><Text style={styles.actor}>{actorName}</Text>{` ${item.message}`}</Text><Text style={styles.time}>{timeAgo(item.created_at)}</Text>{pendingRequest && item.friend_request ? <View style={styles.requestActions}><TouchableOpacity style={styles.acceptButton} onPress={(event) => { event.stopPropagation(); void respond(item.id, item.friend_request!.id, 'accepted'); }}><Text style={styles.acceptButtonText}>Accept</Text></TouchableOpacity><TouchableOpacity style={styles.declineButton} onPress={(event) => { event.stopPropagation(); void respond(item.id, item.friend_request!.id, 'declined'); }}><Text style={styles.declineButtonText}>Decline</Text></TouchableOpacity></View> : null}</View>
            <View style={styles.typeIcon}>{notificationIcon(item.type, theme.primary)}</View>
            {!item.read_at && <View style={styles.dot} />}
          </TouchableOpacity>;
        }}
        ListFooterComponent={<View style={{ height: BottomTabInset + 28 }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingTop: 58, paddingHorizontal: 24, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 10, letterSpacing: 1.5 },
  title: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 35, letterSpacing: -1.2 },
  headerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  markAllButton: { alignSelf: 'flex-end', marginTop: -12, marginBottom: 4, paddingHorizontal: 4, paddingVertical: 5 },
  markAllText: { color: theme.primary, fontFamily: Fonts?.sansSemiBold, fontSize: 11.5 },
  row: { padding: 14, borderRadius: 20, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unread: { borderWidth: 1, borderColor: `${theme.primary}55` },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: theme.backgroundSelected, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' }, avatarText: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 16 },
  copy: { flex: 1, gap: 4 }, message: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20 }, actor: { fontFamily: Fonts?.sansBold }, time: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 7 },
  acceptButton: { height: 32, paddingHorizontal: 15, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 12 },
  declineButton: { height: 32, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: theme.backgroundSelected, alignItems: 'center', justifyContent: 'center' },
  declineButtonText: { color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 12 },
  typeIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }, dot: { position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 34 }, emptyTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 17 }, emptyText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

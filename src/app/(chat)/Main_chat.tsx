import { useFocusEffect, useRouter } from 'expo-router';
import { BellOff, Check, CheckCheck, Pin, Search, SquarePen, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { GradientWrapper } from '@/components/gradient-wrapper';
import { BottomTabInset, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getChatsForUser, type ChatRecord } from '@/lib/chats';
import { getCurrentProfile } from '@/lib/profile';

type Ticks = 'sent' | 'delivered' | 'read' | null;

type Chat = {
  id: string;
  name: string;
  avatar?: string;
  isGroup?: boolean;
  lastMessage: string;
  draft?: string;
  time: string;
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  online?: boolean;
  typing?: boolean;
  hasUnseenStatus?: boolean;
  ticks?: Ticks;
  color: string;
};

const STATUS_RING = ['#4361EE', '#7955D9'] as const;
const CHAT_SECTIONS = ['Chats', 'Groups'] as const;

// Helper to convert database record to Chat type
const chatRecordToChat = (record: ChatRecord, currentUserId: string): Chat => {
  const isGroup = record.type === 'group';
  let name = 'Unknown';
  if (isGroup) {
    name = record.name || 'Group Chat';
  } else {
    name = record.other_user?.full_name || record.other_user?.username || 'User';
  }
  
  return {
    id: record.id,
    name,
    avatar: isGroup ? undefined : record.other_user?.avatar_url || undefined,
    isGroup,
    lastMessage: record.last_message_content || '(No messages yet)',
    time: formatTime(record.updated_at || record.created_at),
    unread: 0, // TODO: track unread messages
    color: generateColor(record.id),
  };
};

// Generate a consistent color for a chat ID
const generateColor = (id: string): string => {
  const colors = ['#E85AAD', '#4361EE', '#3C9CA2', '#D28E4B', '#7955D9', '#F59E55', '#00A6A6', '#FF6B6B'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
};

// Format timestamp to relative time
const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return 'now';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

export default function ChatsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [section, setSection] = useState<(typeof CHAT_SECTIONS)[number]>('Chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await getCurrentProfile();
      if (profile?.id) {
        setCurrentUserId(profile.id);
        const chatRecords = await getChatsForUser();
        const converted = chatRecords.map((rec) => chatRecordToChat(rec, profile.id));
        setChats(converted);
      }
    } catch (error) {
      console.warn('[Main_chat] failed to load chats', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadChats();
    }, [loadChats])
  );

  const activeNow = chats.filter((c) => !c.isGroup && c.online);

  const filtered = chats
    .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((c) => section === 'Groups' ? c.isGroup : !c.isGroup)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  return (
    <View style={styles.container}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>UNIVERSAL</Text>
            <Text style={styles.title}>Chats</Text>
          </View>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setSearching((open) => !open)}>
            <Search size={19} color={theme.text} />
          </TouchableOpacity>
        </View>

        {searching && (
          <View style={styles.searchBox}>
            <Search size={17} color={theme.textSecondary} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search chats"
              placeholderTextColor={theme.textSecondary}
              style={styles.searchInput}
            />
          </View>
        )}

        <View style={styles.sectionTabs}>
          {CHAT_SECTIONS.map((option) => (
            <TouchableOpacity key={option} onPress={() => setSection(option)} style={[styles.sectionTab, section === option && styles.sectionTabActive]} activeOpacity={0.8}>
              <Text style={[styles.sectionTabText, section === option && styles.sectionTabTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerContainer}>
            <Users size={48} color={theme.textSecondary} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{section === 'Groups' ? 'No groups yet' : 'No chats yet'}</Text>
            <Text style={styles.emptySubtitle}>{section === 'Groups' ? 'Create a group to chat together' : 'Start a conversation to get going'}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push(section === 'Groups' ? '/(public)/new_group' : '/(public)/new_chat')}>
              <SquarePen size={18} color={theme.primary} />
              <Text style={styles.emptyButtonText}>{section === 'Groups' ? 'New Group' : 'New Chat'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {section === 'Chats' && activeNow.length > 0 && (
              <>
                <Text style={styles.activeLabel}>Active now</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
                  {activeNow.map((chat) => (
                    <TouchableOpacity key={chat.id} style={styles.activeItem} activeOpacity={0.8} onPress={() => router.push(`/(chat)/${chat.id}`)}>
                  <View style={styles.activeAvatarWrap}>
                    {chat.avatar ? (
                      <Image source={{ uri: chat.avatar }} style={styles.activeAvatar} />
                    ) : (
                      <View style={[styles.activeAvatar, { backgroundColor: chat.color }]}>
                        <Text style={styles.activeAvatarText}>{chat.name[0]}</Text>
                      </View>
                    )}
                    <View style={styles.activeDot} />
                  </View>
                  <Text style={styles.activeName} numberOfLines={1}>{chat.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
              </>
            )}

            {filtered.map((chat) => <ChatRow key={chat.id} chat={chat} styles={styles} theme={theme} onPress={() => router.push(`/(chat)/${chat.id}`)} />)}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => router.push('/(public)/new_chat')}>
        <GradientWrapper colors={['#4361EE', '#7955D9']} style={styles.fabGradient}>
          <SquarePen size={22} color="#fff" strokeWidth={2.4} />
        </GradientWrapper>
      </TouchableOpacity>
    </View>
  );
}

function ChatRow({ chat, styles, theme, onPress }: { chat: Chat; styles: ReturnType<typeof createStyles>; theme: ReturnType<typeof useTheme>; onPress: () => void }) {
  const TickIcon = chat.ticks === 'read' || chat.ticks === 'delivered' ? CheckCheck : chat.ticks === 'sent' ? Check : null;
  const tickColor = chat.ticks === 'read' ? theme.primary : theme.textSecondary;

  return (
    <TouchableOpacity style={[styles.chatRow, chat.pinned && styles.chatRowPinned]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {chat.hasUnseenStatus ? (
          <GradientWrapper colors={STATUS_RING} style={chat.isGroup ? styles.groupRing : styles.avatarRing}>
            <View style={chat.isGroup ? styles.groupAvatarInnerWrap : styles.avatarInnerWrap}>
              <ChatAvatar chat={chat} styles={styles} />
            </View>
          </GradientWrapper>
        ) : (
          <ChatAvatar chat={chat} styles={styles} bare />
        )}
        {chat.online && !chat.isGroup && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.chatCopy}>
        <View style={styles.chatTopLine}>
          <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
          <View style={styles.chatMetaRight}>
            {chat.pinned && <Pin size={11} color={theme.textSecondary} />}
            {chat.muted && <BellOff size={12} color={theme.textSecondary} />}
            <Text style={styles.chatTime}>{chat.time}</Text>
          </View>
        </View>
        <View style={styles.chatBottomLine}>
          <View style={styles.chatPreviewRow}>
            {TickIcon && <TickIcon size={14} color={tickColor} style={{ marginRight: 3 }} />}
            {chat.typing ? (
              <TypingIndicator styles={styles} theme={theme} />
            ) : chat.draft ? (
              <Text style={styles.chatPreview} numberOfLines={1}><Text style={styles.draftLabel}>Draft: </Text>{chat.draft}</Text>
            ) : (
              <Text style={[styles.chatPreview, chat.unread > 0 && styles.chatPreviewUnread]} numberOfLines={1}>{chat.lastMessage}</Text>
            )}
          </View>
          {chat.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{chat.unread > 99 ? '99+' : chat.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChatAvatar({ chat, styles, bare }: { chat: Chat; styles: ReturnType<typeof createStyles>; bare?: boolean }) {
  const shape = chat.isGroup ? styles.groupAvatarShape : styles.avatarShape;
  const wrapper = bare ? [shape, { backgroundColor: chat.color }] : [shape, { backgroundColor: chat.color }];
  if (chat.isGroup) {
    return (
      <View style={wrapper}>
        <Users size={20} color="#fff" />
      </View>
    );
  }
  return chat.avatar ? (
    <Image source={{ uri: chat.avatar }} style={shape} />
  ) : (
    <View style={wrapper}>
      <Text style={styles.avatarInitials}>{chat.name.slice(0, 1)}</Text>
    </View>
  );
}

function TypingIndicator({ styles, theme }: { styles: ReturnType<typeof createStyles>; theme: ReturnType<typeof useTheme> }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay(320),
        ]),
      );
    const loops = [animateDot(dot1, 0), animateDot(dot2, 160), animateDot(dot3, 320)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={styles.typingRow}>
      <Text style={styles.typingText}>typing</Text>
      <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingTop: Platform.OS === 'ios' ? 58 : 44, paddingBottom: BottomTabInset + 40 },
  header: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 10, letterSpacing: 1.5 },
  title: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 30, letterSpacing: -0.8 },
  headerIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },

  searchBox: { marginHorizontal: 24, marginTop: 14, borderRadius: 16, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, color: theme.text, fontFamily: Fonts?.sans, fontSize: 14 },

  activeLabel: { paddingHorizontal: 24, marginTop: 20, color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 12.5 },
  activeRow: { paddingHorizontal: 24, paddingTop: 10, gap: 16 },
  activeItem: { width: 56, alignItems: 'center' },
  activeAvatarWrap: { position: 'relative' },
  activeAvatar: { width: 50, height: 50, borderRadius: 25 },
  activeDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759', borderWidth: 2, borderColor: theme.background },
  activeName: { marginTop: 6, color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 10.5, maxWidth: 56, textAlign: 'center' },

  sectionTabs: { flexDirection: 'row', marginHorizontal: 24, marginTop: 18, marginBottom: 14, padding: 4, borderRadius: 16, backgroundColor: theme.backgroundElement },
  sectionTab: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTabActive: { backgroundColor: theme.primary },
  sectionTabText: { color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 13 },
  sectionTabTextActive: { color: '#fff' },

  centerContainer: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  emptyTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 18 },
  emptySubtitle: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 14, textAlign: 'center' },
  emptyButton: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyButtonText: { color: '#fff', fontFamily: Fonts?.sansSemiBold, fontSize: 14 },
  
  activeAvatarText: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 14 },

  emptyState: { marginHorizontal: 24, marginTop: 30, alignItems: 'center', paddingVertical: 38, borderRadius: 20, borderWidth: 1, borderColor: theme.backgroundElement },
  emptyText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 12.5, marginTop: 4 },

  chatRow: { marginHorizontal: 12, marginTop: 4, padding: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatRowPinned: { backgroundColor: theme.backgroundElement },
  avatarWrap: { position: 'relative' },
  avatarShape: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  groupAvatarShape: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 58, height: 58, borderRadius: 29, padding: 2, alignItems: 'center', justifyContent: 'center' },
  groupRing: { width: 58, height: 58, borderRadius: 20, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatarInnerWrap: { width: '100%', height: '100%', borderRadius: 27, overflow: 'hidden', backgroundColor: theme.background },
  groupAvatarInnerWrap: { width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: theme.background },
  avatarInitials: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 17 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#34C759', borderWidth: 2, borderColor: theme.background },

  chatCopy: { flex: 1 },
  chatTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatName: { flex: 1, color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 15, marginRight: 8 },
  chatMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chatTime: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11.5 },
  chatBottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  chatPreviewRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  chatPreview: { flex: 1, color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13 },
  chatPreviewUnread: { color: theme.text, fontFamily: Fonts?.sansMedium },
  draftLabel: { color: '#E8503A', fontFamily: Fonts?.sansSemiBold },
  unreadBadge: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 11 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typingText: { color: theme.primary, fontFamily: Fonts?.sansSemiBold, fontSize: 13, marginRight: 2 },
  typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary },

  fab: { position: 'absolute', right: 22, bottom: BottomTabInset + 8, width: 58, height: 58, borderRadius: 21, overflow: 'hidden', shadowColor: '#4361EE', shadowOpacity: 0.35, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  fabGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

import { Fonts, Spacing } from '@/constants/theme';
import { getChatMessages, getChatRoom, markChatRead, MessageRecord, sendChatMessage, ChatRoomDetails } from '@/lib/chats';
import { getCurrentProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, Users } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlatList<MessageRecord>>(null);
  const [room, setRoom] = useState<ChatRoomDetails | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getCurrentProfile(), getChatRoom(id), getChatMessages(id)])
      .then(([profile, roomData, messageRows]) => {
        if (!active) return;
        setCurrentUserId(profile?.id || '');
        setRoom(roomData);
        setMessages(messageRows);
        void markChatRead(id);
      })
      .catch((error) => console.warn('[chat room] load failed', error))
      .finally(() => { if (active) setLoading(false); });

    const channel = supabase.channel(`messages:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` }, (payload) => {
        const incoming = payload.new as MessageRecord;
        setMessages((items) => items.some((item) => item.id === incoming.id) ? items : [...items, incoming]);
        void markChatRead(id);
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [id]);

  const otherUser = room?.type === 'individual' ? room.participants?.find((participant) => participant.id !== currentUserId) : null;
  const roomName = room?.type === 'group' ? room.name || 'Group' : otherUser?.full_name || otherUser?.username || 'Chat';
  const roomImage = room?.type === 'group' ? room.image_url : otherUser?.avatar_url;
  const canSend = room?.type !== 'group' || room.current_user_role === 'admin' || room.allow_members_send;

  const handleSend = async () => {
    if (!id || !draft.trim() || sending || !canSend) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const created = await sendChatMessage(id, text);
      setMessages((items) => items.some((item) => item.id === created.id) ? items : [...items, created]);
    } catch (error) {
      console.warn('[chat room] send failed', error);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}><ChevronLeft size={25} color={theme.text} /></TouchableOpacity>
          {roomImage ? <Image source={{ uri: roomImage }} style={styles.avatar} /> : <View style={styles.avatarFallback}>{room?.type === 'group' ? <Users size={19} color="#fff" /> : <Text style={styles.initial}>{roomName.slice(0, 1).toUpperCase()}</Text>}</View>}
          <View style={styles.headerCopy}><Text style={styles.name} numberOfLines={1}>{roomName}</Text><Text style={styles.sub}>{room?.type === 'group' ? `${room.participants?.length || 0} members` : 'Private conversation'}</Text></View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.emptyList]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.emptyText}>Send the first message to begin this conversation.</Text></View>}
          renderItem={({ item }) => {
            const mine = item.sender_id === currentUserId;
            const sender = room?.participants?.find((participant) => participant.id === item.sender_id);
            return <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>{room?.type === 'group' && !mine ? <Text style={styles.senderName}>{sender?.full_name || sender?.username || 'Member'}</Text> : null}<Text style={[styles.messageText, mine && styles.mineText]}>{item.content}</Text><Text style={[styles.time, mine && styles.mineTime]}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(item.created_at))}</Text></View>;
          }}
        />

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}><TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder={canSend ? 'Type a message...' : 'Only admins can send messages'} placeholderTextColor={theme.textSecondary} multiline editable={canSend && !sending} /></View>
          <TouchableOpacity style={[styles.send, (!draft.trim() || !canSend) && styles.sendDisabled]} onPress={handleSend} disabled={!draft.trim() || sending || !canSend}>{sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={19} color="#fff" />}</TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background }, center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }, container: { flex: 1 },
  header: { minHeight: 66, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected }, back: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 43, height: 43, borderRadius: 15 }, avatarFallback: { width: 43, height: 43, borderRadius: 15, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 16 }, headerCopy: { flex: 1 }, name: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 }, sub: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11.5, marginTop: 2 },
  list: { padding: Spacing.three, gap: 8 }, emptyList: { flexGrow: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, emptyTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 17 }, emptyText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, textAlign: 'center', marginTop: 5 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 }, mine: { alignSelf: 'flex-end', backgroundColor: theme.primary, borderBottomRightRadius: 5 }, theirs: { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 5 }, senderName: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 11, marginBottom: 3 }, messageText: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 14.5, lineHeight: 20 }, mineText: { color: '#fff' }, time: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 9.5, alignSelf: 'flex-end', marginTop: 3 }, mineTime: { color: 'rgba(255,255,255,0.75)' },
  inputRow: { paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected, flexDirection: 'row', alignItems: 'flex-end', gap: 9 }, inputWrap: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: theme.backgroundElement, paddingHorizontal: 15, justifyContent: 'center' }, input: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 14.5, maxHeight: 95, paddingVertical: 10 }, send: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: 0.45 },
});

import { Fonts, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRealtimeRecovery } from "@/hooks/use-realtime-recovery";
import { useTheme } from "@/hooks/use-theme";
import {
  ChatRoomDetails,
  getChatMessages,
  getChatRoom,
  markChatRead,
  MessageRecord,
  sendChatMessage,
} from "@/lib/chats";
import { getCurrentProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Send,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlatList<MessageRecord>>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTypingRef = useRef(false);
  const [room, setRoom] = useState<ChatRoomDetails | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const loadChat = useCallback(async () => {
    if (!id) return;
    const [profile, roomData, messageRows] = await Promise.all([
      getCurrentProfile(),
      getChatRoom(id),
      getChatMessages(id),
    ]);
    setCurrentUserId(profile?.id || "");
    setRoom(roomData);
    setMessages(messageRows);
    await markChatRead(id);
  }, [id]);

  useRealtimeRecovery(() =>
    loadChat().catch((error) =>
      console.warn("[chat room] recovery failed", error),
    ),
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    const initialLoad = setTimeout(() => {
      void loadChat()
        .catch((error) => console.warn("[chat room] load failed", error))
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    const channel = supabase
      .channel(`chat:${id}`, {
        config: {
          private: true,
          presence: { key: currentUserId || undefined },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${id}`,
        },
        (payload) => {
          const incoming = payload.new as MessageRecord;
          setMessages((items) =>
            items.some((item) => item.id === incoming.id)
              ? items
              : [...items, incoming],
          );
          void markChatRead(id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `chat_id=eq.${id}`,
        },
        () => {
          void getChatRoom(id)
            .then(setRoom)
            .catch((error) =>
              console.warn("[chat room] receipt refresh failed", error),
            );
        },
      )
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const event = payload as { userId?: string; isTyping?: boolean };
        if (!event.userId || event.userId === currentUserId) return;
        setTypingUserIds((users) =>
          event.isTyping
            ? users.includes(event.userId!)
              ? users
              : [...users, event.userId!]
            : users.filter((userId) => userId !== event.userId),
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void loadChat().catch((error) =>
            console.warn("[chat room] subscription recovery failed", error),
          );
          void getCurrentProfile().then((profile) => {
            if (profile?.id)
              void channel.track({
                userId: profile.id,
                onlineAt: new Date().toISOString(),
              });
          });
        }
      });
    realtimeChannelRef.current = channel;
    return () => {
      active = false;
      clearTimeout(initialLoad);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (sentTypingRef.current && currentUserId) {
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: currentUserId, isTyping: false },
        });
      }
      void channel.untrack();
      void supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [currentUserId, id, loadChat]);

  const otherUser =
    room?.type === "individual"
      ? room.participants?.find(
          (participant) => participant.id !== currentUserId,
        )
      : null;
  const roomName =
    room?.type === "group"
      ? room.name || "Group"
      : otherUser?.full_name || otherUser?.username || "Chat";
  const roomImage =
    room?.type === "group" ? room.image_url : otherUser?.avatar_url;
  const canSend =
    room?.type !== "group" ||
    room.current_user_role === "admin" ||
    room.allow_members_send;
  const otherUsersOnline = onlineUserIds.filter(
    (userId) => userId !== currentUserId,
  ).length;
  const someoneTyping = typingUserIds.some(
    (userId) => userId !== currentUserId,
  );
  const roomSubtitle = someoneTyping
    ? "typing…"
    : room?.type === "group"
      ? `${room.participants?.length || 0} members${otherUsersOnline ? ` · ${otherUsersOnline} online` : ""}`
      : otherUsersOnline > 0
        ? "Online"
        : "Private conversation";

  const broadcastTyping = (isTyping: boolean) => {
    if (!currentUserId) return;
    void realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, isTyping },
    });
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!value.trim()) {
      if (sentTypingRef.current) broadcastTyping(false);
      sentTypingRef.current = false;
      return;
    }
    if (!sentTypingRef.current) {
      sentTypingRef.current = true;
      broadcastTyping(true);
    }
    typingTimerRef.current = setTimeout(() => {
      sentTypingRef.current = false;
      broadcastTyping(false);
    }, 1200);
  };

  const handleSend = async () => {
    if (!id || !draft.trim() || sending || !canSend) return;
    const text = draft.trim();
    setDraft("");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (sentTypingRef.current) broadcastTyping(false);
    sentTypingRef.current = false;
    setSending(true);
    try {
      const created = await sendChatMessage(id, text);
      setMessages((items) =>
        items.some((item) => item.id === created.id)
          ? items
          : [...items, created],
      );
    } catch (error) {
      console.warn("[chat room] send failed", error);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <ChevronLeft size={25} color={theme.text} />
          </TouchableOpacity>
          {roomImage ? (
            <Image source={{ uri: roomImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              {room?.type === "group" ? (
                <Users size={19} color="#fff" />
              ) : (
                <Text style={styles.initial}>
                  {roomName.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {roomName}
            </Text>
            <Text style={styles.sub}>{roomSubtitle}</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            messages.length === 0 && styles.emptyList,
          ]}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Send the first message to begin this conversation.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === currentUserId;
            const sender = room?.participants?.find(
              (participant) => participant.id === item.sender_id,
            );
            const recipients =
              room?.participants?.filter(
                (participant) => participant.id !== currentUserId,
              ) ?? [];
            const read =
              mine &&
              recipients.length > 0 &&
              recipients.every(
                (participant) =>
                  participant.last_read_at &&
                  new Date(participant.last_read_at) >=
                    new Date(item.created_at),
              );
            const delivered =
              mine &&
              recipients.length > 0 &&
              recipients.every(
                (participant) =>
                  participant.last_delivered_at &&
                  new Date(participant.last_delivered_at) >=
                    new Date(item.created_at),
              );
            const ReceiptIcon =
              read || delivered ? CheckCheck : mine ? Check : null;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {room?.type === "group" && !mine ? (
                  <Text style={styles.senderName}>
                    {sender?.full_name || sender?.username || "Member"}
                  </Text>
                ) : null}
                <Text style={[styles.messageText, mine && styles.mineText]}>
                  {item.content}
                </Text>
                <View style={styles.timeRow}>
                  <Text style={[styles.time, mine && styles.mineTime]}>
                    {new Intl.DateTimeFormat(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(item.created_at))}
                  </Text>
                  {ReceiptIcon ? (
                    <ReceiptIcon
                      size={13}
                      color={read ? "#B8E8FF" : "rgba(255,255,255,0.72)"}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={handleDraftChange}
              placeholder={
                canSend ? "Type a message..." : "Only admins can send messages"
              }
              placeholderTextColor={theme.textSecondary}
              multiline
              editable={canSend && !sending}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.send,
              (!draft.trim() || !canSend) && styles.sendDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || sending || !canSend}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={19} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    container: { flex: 1 },
    header: {
      minHeight: 66,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.backgroundSelected,
    },
    back: {
      width: 34,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: { width: 43, height: 43, borderRadius: 15 },
    avatarFallback: {
      width: 43,
      height: 43,
      borderRadius: 15,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    initial: { color: "#fff", fontFamily: Fonts?.sansBold, fontSize: 16 },
    headerCopy: { flex: 1 },
    name: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 },
    sub: {
      color: theme.textSecondary,
      fontFamily: Fonts?.sans,
      fontSize: 11.5,
      marginTop: 2,
    },
    list: { padding: Spacing.three, gap: 8 },
    emptyList: { flexGrow: 1 },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
    },
    emptyTitle: {
      color: theme.text,
      fontFamily: Fonts?.sansBold,
      fontSize: 17,
    },
    emptyText: {
      color: theme.textSecondary,
      fontFamily: Fonts?.sans,
      fontSize: 13,
      textAlign: "center",
      marginTop: 5,
    },
    bubble: {
      maxWidth: "80%",
      borderRadius: 18,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    mine: {
      alignSelf: "flex-end",
      backgroundColor: theme.primary,
      borderBottomRightRadius: 5,
    },
    theirs: {
      alignSelf: "flex-start",
      backgroundColor: theme.backgroundElement,
      borderBottomLeftRadius: 5,
    },
    senderName: {
      color: theme.primary,
      fontFamily: Fonts?.sansBold,
      fontSize: 11,
      marginBottom: 3,
    },
    messageText: {
      color: theme.text,
      fontFamily: Fonts?.sans,
      fontSize: 14.5,
      lineHeight: 20,
    },
    mineText: { color: "#fff" },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-end",
      gap: 3,
      marginTop: 3,
    },
    time: {
      color: theme.textSecondary,
      fontFamily: Fonts?.sans,
      fontSize: 9.5,
    },
    mineTime: { color: "rgba(255,255,255,0.75)" },
    inputRow: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.backgroundSelected,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 9,
    },
    inputWrap: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      borderRadius: 22,
      backgroundColor: theme.backgroundElement,
      paddingHorizontal: 15,
      justifyContent: "center",
    },
    input: {
      color: theme.text,
      fontFamily: Fonts?.sans,
      fontSize: 14.5,
      maxHeight: 95,
      paddingVertical: 10,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendDisabled: { opacity: 0.45 },
  });

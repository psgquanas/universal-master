import { useFocusEffect, useRouter } from 'expo-router';
import { Bookmark, Camera, CheckCircle2, Heart, MessageCircle, MoreHorizontal, Plus, Search, Share2, Sparkles, Users, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, Pressable, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';

import { GradientWrapper } from '@/components/gradient-wrapper';
import { BottomTabInset, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentProfile, ProfileRecord } from '@/lib/profile';
import { getUnreadMessageCount } from '@/lib/chats';
import { subscribeToFeedChanges } from '@/lib/feed-events';
import { addPostComment, addStoryComment, createStory, getConnectedFeed, getConnectedProfiles, getConnectedStories, sharePost, shareStory, togglePostLike, toggleStoryLike, uploadSocialMedia } from '@/lib/social';
import { supabase } from '@/lib/supabase';

type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

type Story = { id: string; name: string; initials: string; color: string; own?: boolean; seen?: boolean; avatar?: string; content?: string | null; contentType?: string; mediaUrl?: string | null; authorId?: string };

type Pulse = {
  id: string;
  author: string;
  initials: string;
  avatar?: string;
  ago: string;
  text: string;
  images?: string[];
  likes: number;
  likedBy: string[];
  comments: number;
  topComment?: { author: string; text: string };
  reaction: ReactionType | null;
  color: string;
  channel?: string;
};

const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like', color: '#5E8BFF' },
  { type: 'love', emoji: '❤️', label: 'Love', color: '#E85AAD' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: '#F5B942' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: '#F5B942' },
  { type: 'sad', emoji: '😢', label: 'Sad', color: '#5E8BFF' },
  { type: 'angry', emoji: '😡', label: 'Angry', color: '#E8503A' },
];

const gradient = ['#5E5CE6', '#7B5CFA', '#E85AAD'] as const;
const SEEN_RING = ['#D9D9E3', '#D9D9E3'] as const;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_WIDTH = SCREEN_WIDTH - 70;

function getDisplayInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function PulseHomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyViewer, setStoryViewer] = useState<Story | null>(null);
  const [friends, setFriends] = useState<{ id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null }[]>([]);
  const [shareTarget, setShareTarget] = useState<{ kind: 'post' | 'story'; id: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latestHomeLoad = useRef(0);
  const visiblePulses = pulses.filter((pulse) => `${pulse.author} ${pulse.channel} ${pulse.text}`.toLowerCase().includes(query.toLowerCase()));

  const loadHomeData = useCallback(async () => {
    const loadId = ++latestHomeLoad.current;

    try {
      const currentProfile = await getCurrentProfile();
      if (loadId !== latestHomeLoad.current) return;
      setProfile(currentProfile);

      if (!currentProfile?.id) {
        setStories([]);
        setFriends([]);
        setPulses([]);
        return;
      }

      const [storyRows, feedRows, connectedProfiles] = await Promise.all([
        getConnectedStories(currentProfile.id),
        getConnectedFeed(currentProfile.id),
        getConnectedProfiles(currentProfile.id),
      ]);
      if (loadId !== latestHomeLoad.current) return;

      const friendStories = storyRows.filter((story: any) => story.author_id !== currentProfile.id).map((story: any, index) => {
        const friendName = story.profiles?.full_name?.trim() || story.profiles?.username || 'Friend';
        return {
          id: story.id,
          name: friendName,
          initials: getDisplayInitials(friendName),
          avatar: story.profiles?.avatar_url || undefined,
          color: ['#6D5DFB', '#E85AAD', '#00A6A6', '#F59E55'][index % 4],
          content: story.content,
          contentType: story.content_type,
          mediaUrl: story.media_url,
          authorId: story.author_id,
        };
      });

      const ownStory: Story = {
        id: 'your-pulse',
        name: 'Your pulse',
        initials: '+',
        color: '#6D5DFB',
        own: true,
        avatar: currentProfile.avatar_url || undefined,
      };

      setStories([ownStory, ...friendStories]);
      setFriends(connectedProfiles);
      setPulses(feedRows.map((post: any, index: number) => {
        const author = post.profiles?.full_name?.trim() || post.profiles?.username || 'Universal user';
        const liked = (post.likes ?? []).some((like: any) => like.user_id === currentProfile.id);
        const comment = post.comments?.[0];
        return { id: post.id, author, initials: getDisplayInitials(author), avatar: post.profiles?.avatar_url || undefined, ago: new Date(post.created_at).toLocaleDateString(), text: post.content || '', images: post.media_url ? [post.media_url] : undefined, likes: post.likes?.length ?? 0, likedBy: post.likes?.map((like: any) => like.user_id) ?? [], comments: post.comments?.length ?? 0, topComment: comment ? { author: comment.profiles?.full_name || comment.profiles?.username || 'Friend', text: comment.content } : undefined, reaction: liked ? 'like' : null, color: ['#6D5DFB', '#E85AAD', '#00A6A6', '#F59E55'][index % 4], channel: 'Your circle' };
      }));
    } catch (error) {
      if (loadId === latestHomeLoad.current) console.warn('[home] could not load home data', error);
    }
  }, []);

  useEffect(() => {
    return () => { latestHomeLoad.current += 1; };
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      setUnreadMessages(await getUnreadMessageCount());
    } catch (error) {
      console.warn('[home] unread count failed', error);
    }
  }, []);

  const refreshHome = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadHomeData(), refreshUnread()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeData, refreshUnread]);

  useFocusEffect(useCallback(() => { void refreshUnread(); }, [refreshUnread]));

  useFocusEffect(useCallback(() => { void loadHomeData(); }, [loadHomeData]));

  useEffect(() => {
    const channel = supabase.channel('home-unread-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { void refreshUnread(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshUnread]);

  useEffect(() => {
    const channel = supabase.channel('home-feed-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => { void loadHomeData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => { void loadHomeData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => { void loadHomeData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, () => { void loadHomeData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadHomeData]);

  useEffect(() => subscribeToFeedChanges(() => { void loadHomeData(); }), [loadHomeData]);

  const toggleReaction = async (id: string, type: ReactionType) => {
    const current = pulses.find((pulse) => pulse.id === id);
    if (!current) return;
    try { await togglePostLike(id, Boolean(current.reaction)); } catch (error) { console.warn('[home] like failed', error); return; }
    setPulses((items) =>
      items.map((pulse) => {
        if (pulse.id !== id) return pulse;
        if (pulse.reaction === type) return { ...pulse, reaction: null, likes: pulse.likes - 1 };
        return { ...pulse, reaction: type, likes: pulse.reaction ? pulse.likes : pulse.likes + 1 };
      }),
    );
  };

  const doubleTapLike = async (id: string) => {
    const current = pulses.find((pulse) => pulse.id === id);
    if (!current || current.reaction) return;
    try { await togglePostLike(id, false); } catch (error) { console.warn('[home] like failed', error); return; }
    setPulses((items) =>
      items.map((pulse) => {
        if (pulse.id !== id || pulse.reaction === 'love') return pulse;
        return { ...pulse, reaction: 'love', likes: pulse.reaction ? pulse.likes : pulse.likes + 1 };
      }),
    );
  };

  const markStorySeen = (story: Story) => {
    if (story.own) return;
    setStories((items) => items.map((s) => (s.id === story.id ? { ...s, seen: true } : s)));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <FlatList
        data={visiblePulses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feed}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshHome}
            colors={[theme.primary]}
            progressBackgroundColor={theme.backgroundElement}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <TouchableOpacity style={styles.profileChip} onPress={() => router.push('/(public)/profile')}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} /> : <GradientWrapper colors={gradient} style={styles.profileGradient}><Text style={styles.profileInitials}>{profile ? getDisplayInitials(profile.full_name || profile.username || 'User') : 'U'}</Text></GradientWrapper>}</TouchableOpacity>
              <View style={styles.brand}><View style={styles.brandRow}><View style={styles.brandDot} /><Text style={styles.brandName}>Universal</Text></View><Text style={styles.brandSub}>Universal Chat</Text></View>
              <TouchableOpacity style={styles.inboxButton} onPress={() => router.push('/(chat)/Main_chat')}><MessageCircle size={20} color={theme.text} />{unreadMessages > 0 ? <View style={styles.inboxBadge}><Text style={styles.inboxBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text></View> : null}</TouchableOpacity>
            </View>

            {searching ? <View style={styles.searchBox}><Search size={18} color={theme.textSecondary} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Find people, circles, ideas" placeholderTextColor={theme.textSecondary} style={styles.searchInput} /></View> : null}
            <View style={styles.actionRow}><TouchableOpacity style={styles.searchAction} onPress={() => setSearching((open) => !open)}><Search size={18} color={theme.primary} /><Text style={styles.searchActionText}>{searching ? 'Close search' : 'Explore your circles'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.scheduleAction} onPress={() => router.push('/(app)/scheduling')}><Sparkles size={17} color={theme.secondary} /></TouchableOpacity></View>

            <View style={styles.storiesHeader}><Text style={styles.sectionTitle}>Moments</Text><Text style={styles.sectionLink}>Close friends</Text></View>
            <FlatList
              horizontal
              data={stories}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stories}
              renderItem={({ item, index }) => (
                <StoryItem
                  item={item}
                  index={index}
                  styles={styles}
                  onPress={() => {
                    markStorySeen(item);
                    if (item.own) setStoryComposerOpen(true);
                    else setStoryViewer(item);
                  }}
                />
              )}
            />

            <TouchableOpacity style={styles.shareCard} activeOpacity={0.86} onPress={() => setStoryComposerOpen(true)}><View style={styles.shareAvatar}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.shareAvatarImage} /> : <Text style={styles.shareAvatarText}>{profile ? getDisplayInitials(profile.full_name || profile.username || 'User') : 'U'}</Text>}</View><Text style={styles.sharePrompt}>Share something with your circle</Text><View style={styles.shareCamera}><Camera size={17} color={theme.primary} /></View></TouchableOpacity>
            <View style={styles.feedTitleRow}><View><Text style={styles.sectionTitle}>Your feed</Text><Text style={styles.feedHint}>Fresh from the people and channels you follow</Text></View><TouchableOpacity><MoreHorizontal size={22} color={theme.textSecondary} /></TouchableOpacity></View>
          </>
        }
        renderItem={({ item, index }) => (
          <PulseCard
            item={item}
            index={index}
            styles={styles}
            theme={theme}
            onToggleReaction={(type) => toggleReaction(item.id, type)}
            onDoubleTapLike={() => doubleTapLike(item.id)}
            onComment={async (content) => { await addPostComment(item.id, content); setPulses((rows) => rows.map((row) => row.id === item.id ? { ...row, comments: row.comments + 1, topComment: { author: profile?.full_name || profile?.username || 'You', text: content } } : row)); }}
            onShare={() => setShareTarget({ kind: 'post', id: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={
          <View style={styles.emptyFeedCard}>
            <Text style={styles.emptyFeedTitle}>Your feed is ready for your first update</Text>
            <Text style={styles.emptyFeedText}>Once you add friends and connect with people, their activity will appear here.</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setFabMenuOpen(true)}><GradientWrapper colors={gradient} style={styles.fabGradient}><Plus size={25} color="#fff" strokeWidth={2.6} /></GradientWrapper></TouchableOpacity>

      <Modal visible={fabMenuOpen} animationType="fade" transparent onRequestClose={() => setFabMenuOpen(false)}>
        <Pressable style={styles.fabMenuOverlay} onPress={() => setFabMenuOpen(false)}>
          <View style={styles.fabMenuContainer}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setFabMenuOpen(false);
                router.push('/(public)/new_chat');
              }}
            >
              <MessageCircle size={20} color={theme.primary} />
              <Text style={styles.fabMenuText}>New chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setFabMenuOpen(false);
                router.push('/(public)/new_group');
              }}
            >
              <Users size={20} color={theme.primary} />
              <Text style={styles.fabMenuText}>New group</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <StoryComposer visible={storyComposerOpen} theme={theme} onClose={() => setStoryComposerOpen(false)} onSaved={() => { setStoryComposerOpen(false); void loadHomeData(); }} />
      <StoryViewer story={storyViewer} theme={theme} onClose={() => setStoryViewer(null)} onShare={(id) => { setStoryViewer(null); setShareTarget({ kind: 'story', id }); }} />
      <SharePicker visible={Boolean(shareTarget)} friends={friends} theme={theme} onClose={() => setShareTarget(null)} onSelect={async (recipientId) => { if (!shareTarget) return; if (shareTarget.kind === 'post') await sharePost(shareTarget.id, recipientId); else await shareStory(shareTarget.id, recipientId); setShareTarget(null); }} />
    </SafeAreaView>
  );
}

function StoryComposer({ visible, theme, onClose, onSaved }: { visible: boolean; theme: ReturnType<typeof useTheme>; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<{ uri: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'] as any, allowsEditing: true, quality: 0.85 });
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri, type: result.assets[0].mimeType || (result.assets[0].type === 'video' ? 'video/mp4' : 'image/jpeg') });
  };
  const save = async () => {
    if ((!text.trim() && !media) || saving) return;
    setSaving(true);
    try { const mediaUrl = media ? await uploadSocialMedia(media.uri, media.type) : null; await createStory({ content: text, contentType: media ? media.type.startsWith('video') ? 'video' : 'image' : 'text', mediaUrl }); setText(''); setMedia(null); onSaved(); } catch (error) { console.warn('[home] story creation failed', error); } finally { setSaving(false); }
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(3,7,18,0.35)', justifyContent: 'flex-end' }}><View style={{ backgroundColor: theme.background, padding: 24, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 14 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 20 }}>Add a moment</Text><TouchableOpacity onPress={onClose}><X size={20} color={theme.textSecondary} /></TouchableOpacity></View><TextInput multiline value={text} onChangeText={setText} placeholder="Write something for your circle" placeholderTextColor={theme.textSecondary} style={{ minHeight: 90, color: theme.text, backgroundColor: theme.backgroundElement, borderRadius: 16, padding: 14, textAlignVertical: 'top' }} />{media ? <Image source={{ uri: media.uri }} style={{ width: '100%', height: 150, borderRadius: 16 }} /> : null}<View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity onPress={pickMedia} style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}><Camera size={18} color={theme.primary} /><Text style={{ color: theme.text, fontFamily: Fonts?.sansSemiBold }}>Photo or video</Text></TouchableOpacity><TouchableOpacity onPress={save} disabled={saving || (!text.trim() && !media)} style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: Fonts?.sansBold }}>{saving ? 'Sharing…' : 'Share moment'}</Text></TouchableOpacity></View></View></View></Modal>;
}

function StoryViewer({ story, theme, onClose, onShare }: { story: Story | null; theme: ReturnType<typeof useTheme>; onClose: () => void; onShare: (id: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');
  if (!story) return null;
  const submitComment = async () => { if (!comment.trim()) return; try { await addStoryComment(story.id, comment); setComment(''); } catch (error) { console.warn('[home] story comment failed', error); } };
  const like = async () => { try { await toggleStoryLike(story.id, liked); setLiked(!liked); } catch (error) { console.warn('[home] story like failed', error); } };
  return <Modal visible animationType="fade" transparent onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#080611', justifyContent: 'center', padding: 18 }}><View style={{ flex: 1, maxHeight: 650, borderRadius: 28, overflow: 'hidden', backgroundColor: theme.backgroundElement, justifyContent: 'flex-end' }}>{story.mediaUrl ? story.contentType === 'video' ? <StoryVideo uri={story.mediaUrl} /> : <Image source={{ uri: story.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}<View style={{ padding: 22, backgroundColor: story.mediaUrl ? 'rgba(0,0,0,0.45)' : theme.backgroundElement, gap: 14 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 16 }}>{story.name}</Text><TouchableOpacity onPress={onClose}><X size={22} color="#fff" /></TouchableOpacity></View>{story.content ? <Text style={{ color: '#fff', fontFamily: Fonts?.sans, fontSize: 21, lineHeight: 29 }}>{story.content}</Text> : null}<View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity onPress={like} style={{ height: 44, width: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Heart size={20} color={liked ? '#E85AAD' : '#fff'} fill={liked ? '#E85AAD' : 'transparent'} /></TouchableOpacity><TextInput value={comment} onChangeText={setComment} onSubmitEditing={submitComment} placeholder="Comment" placeholderTextColor="#ddd" style={{ flex: 1, height: 44, borderRadius: 15, paddingHorizontal: 14, color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)' }} /><TouchableOpacity onPress={submitComment} style={{ height: 44, paddingHorizontal: 14, borderRadius: 15, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}><MessageCircle size={18} color="#fff" /></TouchableOpacity><TouchableOpacity onPress={() => onShare(story.id)} style={{ height: 44, width: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Share2 size={18} color="#fff" /></TouchableOpacity></View></View></View></View></Modal>;
}

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => { videoPlayer.loop = true; videoPlayer.play(); });
  return <VideoView player={player} nativeControls contentFit="cover" style={StyleSheet.absoluteFill} />;
}

function SharePicker({ visible, friends, theme, onClose, onSelect }: { visible: boolean; friends: { id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null }[]; theme: ReturnType<typeof useTheme>; onClose: () => void; onSelect: (id: string) => Promise<void> }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,7,18,0.35)' }}><View style={{ maxHeight: '70%', backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 20 }}>Share with a friend</Text><TouchableOpacity onPress={onClose}><X size={20} color={theme.textSecondary} /></TouchableOpacity></View>{friends.length ? friends.map((friend) => { const name = friend.full_name || friend.username || 'Friend'; return <TouchableOpacity key={friend.id} onPress={() => { void onSelect(friend.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: theme.backgroundElement }}><View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.backgroundSelected, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>{friend.avatar_url ? <Image source={{ uri: friend.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: theme.primary, fontFamily: Fonts?.sansBold }}>{getDisplayInitials(name)}</Text>}</View><Text style={{ flex: 1, color: theme.text, fontFamily: Fonts?.sansSemiBold }}>{name}</Text><Share2 size={18} color={theme.primary} /></TouchableOpacity>; }) : <Text style={{ color: theme.textSecondary, paddingVertical: 24, textAlign: 'center' }}>Connect with someone before sharing.</Text>}</View></View></Modal>;
}

// ---------- Moments / Stories ----------

function StoryItem({ item, index, styles, onPress }: { item: Story; index: number; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  const [entranceOpacity] = useState(() => new Animated.Value(0));
  const [entranceScale] = useState(() => new Animated.Value(0.75));
  const [pulse] = useState(() => new Animated.Value(1));
  const [pressScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(entranceOpacity, { toValue: 1, duration: 360, delay: index * 65, useNativeDriver: true }).start();
    Animated.spring(entranceScale, { toValue: 1, delay: index * 65, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [entranceOpacity, entranceScale, index]);

  useEffect(() => {
    if (item.own || item.seen) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 950, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [item.own, item.seen, pulse]);

  const pressIn = () => Animated.spring(pressScale, { toValue: 0.92, useNativeDriver: true, friction: 5 }).start();
  const pressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

  return (
    <Animated.View style={{ opacity: entranceOpacity, transform: [{ scale: entranceScale }] }}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[styles.story, { transform: [{ scale: Animated.multiply(pulse, pressScale) }] }]}>
          <GradientWrapper colors={item.own ? gradient : item.seen ? SEEN_RING : [item.color, `${item.color}99`]} style={styles.storyRing}>
            <View style={styles.storyAvatarWrap}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.storyAvatarImage} />
              ) : (
                <View style={[styles.storyAvatar, { backgroundColor: item.color }]}>
                  <Text style={styles.storyInitials}>{item.initials}</Text>
                </View>
              )}
            </View>
          </GradientWrapper>
          <Text style={styles.storyName} numberOfLines={1}>{item.name}</Text>
          {item.own && <View style={styles.addStory}><Plus size={11} color="#fff" /></View>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ---------- Feed card ----------

function PulseCard({
  item,
  index,
  styles,
  theme,
  onToggleReaction,
  onDoubleTapLike,
  onComment,
  onShare,
}: {
  item: Pulse;
  index: number;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useTheme>;
  onToggleReaction: (type: ReactionType) => void;
  onDoubleTapLike: () => void;
  onComment: (content: string) => Promise<void>;
  onShare: () => void;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState('');
  const lastTap = useRef(0);

  const [cardOpacity] = useState(() => new Animated.Value(0));
  const [cardTranslate] = useState(() => new Animated.Value(18));
  const [heartScale] = useState(() => new Animated.Value(0));
  const [heartOpacity] = useState(() => new Animated.Value(0));
  const [likeButtonScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(cardOpacity, { toValue: 1, duration: 420, delay: Math.min(index, 4) * 70, useNativeDriver: true }).start();
    Animated.spring(cardTranslate, { toValue: 0, delay: Math.min(index, 4) * 70, friction: 8, tension: 50, useNativeDriver: true }).start();
  }, [cardOpacity, cardTranslate, index]);

  const bounceLikeButton = () => {
    likeButtonScale.setValue(0.85);
    Animated.spring(likeButtonScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  };

  const burstHeart = () => {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(280),
      Animated.timing(heartOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      onDoubleTapLike();
      burstHeart();
    }
    lastTap.current = now;
  };

  const handleReactionPress = () => {
    if (pickerVisible) {
      setPickerVisible(false);
      return;
    }
    bounceLikeButton();
    onToggleReaction('like');
  };

  const handleReactionLongPress = () => setPickerVisible(true);

  const activeReaction = REACTIONS.find((r) => r.type === item.reaction);
  const others = Math.max(item.likes - item.likedBy.length, 0);

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }}>
      <View style={styles.pulseCard}>
        <View style={styles.pulseHeader}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.authorAvatarImage} />
          ) : (
            <View style={[styles.authorAvatar, { backgroundColor: item.color }]}><Text style={styles.authorInitials}>{item.initials}</Text></View>
          )}
          <View style={styles.authorCopy}>
            <View style={styles.authorNameRow}><Text style={styles.authorName}>{item.author}</Text><CheckCircle2 size={13} color={theme.primary} fill={theme.primary} /></View>
            <Text style={styles.pulseMeta}>{item.ago} · {item.channel}</Text>
          </View>
          <TouchableOpacity><MoreHorizontal size={21} color={theme.textSecondary} /></TouchableOpacity>
        </View>

        <Text style={styles.pulseText}>{item.text}</Text>

        {item.images && item.images.length > 0 && (
          <View>
            <Pressable onPress={handleImagePress}>
              {item.images.length > 1 ? (
                <View>
                  <FlatList
                    horizontal
                    pagingEnabled
                    data={item.images}
                    keyExtractor={(uri) => uri}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_WIDTH))}
                    renderItem={({ item: uri }) => <Image source={{ uri }} style={styles.pulseImageCarousel} />}
                  />
                  <View style={styles.dotsRow}>
                    {item.images.map((uri, i) => (
                      <View key={uri} style={[styles.dot, i === activeImage && styles.dotActive]} />
                    ))}
                  </View>
                </View>
              ) : (
                <Image source={{ uri: item.images[0] }} style={styles.pulseImage} />
              )}
            </Pressable>
            <Animated.View pointerEvents="none" style={[styles.heartBurst, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
              <Heart size={82} color="#fff" fill="#fff" />
            </Animated.View>
          </View>
        )}

        {item.likedBy.length > 0 && (
          <View style={styles.likedByRow}>
            <View style={styles.likedByIcon}><Heart size={10} color="#fff" fill="#fff" /></View>
            <Text style={styles.likedByText} numberOfLines={1}>
              Liked by <Text style={styles.likedByName}>{item.likedBy[0]}</Text>
              {item.likedBy.length > 1 && <Text> and <Text style={styles.likedByName}>{item.likedBy[1]}</Text></Text>}
              {others > 0 && <Text> and {others} others</Text>}
            </Text>
          </View>
        )}

        <View style={styles.reactions}>
          <View>
            {pickerVisible && (
              <View style={styles.reactionPicker}>
                {REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.type}
                    style={styles.reactionPickerItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      onToggleReaction(r.type);
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={styles.reactionPickerEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Animated.View style={{ transform: [{ scale: likeButtonScale }] }}>
              <TouchableOpacity style={styles.reaction} onPress={handleReactionPress} onLongPress={handleReactionLongPress} delayLongPress={220}>
                {activeReaction ? (
                  <Text style={styles.reactionEmojiInline}>{activeReaction.emoji}</Text>
                ) : (
                  <Heart size={19} color={theme.textSecondary} fill="transparent" />
                )}
                <Text style={[styles.reactionText, activeReaction && { color: activeReaction.color, fontFamily: Fonts?.sansSemiBold }]}>
                  {activeReaction ? activeReaction.label : item.likes}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <TouchableOpacity style={styles.reaction} onPress={() => setCommenting((value) => !value)}><MessageCircle size={19} color={theme.textSecondary} /><Text style={styles.reactionText}>{item.comments}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.reaction} onPress={onShare}><Share2 size={18} color={theme.textSecondary} /><Text style={styles.reactionText}>Share</Text></TouchableOpacity>
          <TouchableOpacity style={styles.save}><Bookmark size={19} color={theme.primary} /></TouchableOpacity>
        </View>

        {commenting && <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><TextInput value={comment} onChangeText={setComment} placeholder="Write a comment" placeholderTextColor={theme.textSecondary} style={{ flex: 1, height: 40, borderRadius: 14, paddingHorizontal: 12, color: theme.text, backgroundColor: theme.background }} /><TouchableOpacity disabled={!comment.trim()} onPress={async () => { const value = comment.trim(); if (!value) return; try { await onComment(value); setComment(''); setCommenting(false); } catch (error) { console.warn('[home] comment failed', error); } }} style={{ paddingHorizontal: 14, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: Fonts?.sansBold }}>Post</Text></TouchableOpacity></View>}

        {item.topComment && (
          <View style={styles.commentPreview}>
            <Text style={styles.commentPreviewText}>
              <Text style={styles.commentPreviewAuthor}>{item.topComment.author} </Text>
              {item.topComment.text}
            </Text>
            <Text style={styles.viewAllComments}>View all {item.comments} comments</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background }, feed: { paddingBottom: BottomTabInset + 34 },
  header: { minHeight: 66, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, profileChip: { width: 43, height: 43, borderRadius: 17, overflow: 'hidden' }, profileImage: { width: '100%', height: '100%' }, profileGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' }, profileInitials: { color: '#fff', fontSize: 13, fontFamily: Fonts?.sansBold }, brand: { alignItems: 'center' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, brandDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary }, brandName: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 19, letterSpacing: -0.4 }, brandSub: { color: theme.textSecondary, fontFamily: Fonts?.sansBold, fontSize: 8, letterSpacing: 1.25, marginTop: 1 }, inboxButton: { width: 43, height: 43, borderRadius: 16, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center', position: 'relative' }, inboxBadge: { position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.secondary, borderWidth: 2, borderColor: theme.background }, inboxBadgeText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 9 },
  actionRow: { marginHorizontal: 20, marginTop: 10, flexDirection: 'row', gap: 8 }, searchAction: { flex: 1, height: 44, paddingHorizontal: 14, borderRadius: 16, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchActionText: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 13 }, scheduleAction: { width: 44, height: 44, borderRadius: 16, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' }, searchBox: { marginHorizontal: 20, marginTop: 10, borderRadius: 16, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 }, searchInput: { flex: 1, paddingVertical: 12, color: theme.text, fontFamily: Fonts?.sans, fontSize: 14 },
  storiesHeader: { marginTop: 24, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 17 }, sectionLink: { color: theme.primary, fontFamily: Fonts?.sansSemiBold, fontSize: 12 }, stories: { paddingHorizontal: 20, paddingTop: 13, gap: 14 }, story: { width: 61, alignItems: 'center', position: 'relative' }, storyRing: { width: 56, height: 56, borderRadius: 20, padding: 2, alignItems: 'center', justifyContent: 'center' }, storyAvatarWrap: { width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden' }, storyAvatarImage: { width: '100%', height: '100%' }, storyAvatar: { width: '100%', height: '100%', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, storyInitials: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 13 }, storyName: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 10, marginTop: 6, maxWidth: 66 }, addStory: { position: 'absolute', top: 40, right: 0, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, borderWidth: 2, borderColor: theme.background },
  shareCard: { marginHorizontal: 20, marginTop: 23, borderRadius: 20, backgroundColor: theme.backgroundElement, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, shareAvatar: { width: 35, height: 35, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary }, shareAvatarImage: { width: '100%', height: '100%' }, shareAvatarText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 11 }, sharePrompt: { flex: 1, color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13 }, shareCamera: { width: 32, height: 32, borderRadius: 11, backgroundColor: theme.backgroundSelected, alignItems: 'center', justifyContent: 'center' }, feedTitleRow: { marginTop: 28, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, feedHint: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11 },
  pulseCard: { marginHorizontal: 20, borderRadius: 23, padding: 15, backgroundColor: theme.backgroundElement, shadowColor: '#241B4D', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, authorAvatar: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, authorAvatarImage: { width: 40, height: 40, borderRadius: 15 }, authorInitials: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 12 }, authorCopy: { flex: 1 }, authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, authorName: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 14 }, pulseMeta: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11, marginTop: 2 }, pulseText: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, marginTop: 14 },
  pulseImage: { width: '100%', height: 194, borderRadius: 16, marginTop: 13, backgroundColor: theme.backgroundSelected },
  pulseImageCarousel: { width: CAROUSEL_WIDTH, height: 194, borderRadius: 16, marginTop: 13, backgroundColor: theme.backgroundSelected },
  dotsRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 14, backgroundColor: '#fff' },
  heartBurst: { position: 'absolute', top: 13, left: 0, right: 0, height: 194, alignItems: 'center', justifyContent: 'center' },
  likedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  likedByIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E85AAD', alignItems: 'center', justifyContent: 'center' },
  likedByText: { flex: 1, color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 12 },
  likedByName: { color: theme.text, fontFamily: Fonts?.sansSemiBold },
  reactions: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.backgroundSelected, flexDirection: 'row', alignItems: 'center', gap: 17 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 5 }, reactionText: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 12 }, reactionEmojiInline: { fontSize: 16 }, save: { marginLeft: 'auto' },
  reactionPicker: { position: 'absolute', bottom: '100%', left: -6, marginBottom: 10, flexDirection: 'row', backgroundColor: theme.background, borderRadius: 24, paddingHorizontal: 8, paddingVertical: 6, gap: 4, shadowColor: '#241B4D', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6, zIndex: 10 },
  reactionPickerItem: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  reactionPickerEmoji: { fontSize: 22 },
  commentPreview: { marginTop: 10 },
  commentPreviewText: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 12.5, lineHeight: 18 },
  commentPreviewAuthor: { fontFamily: Fonts?.sansSemiBold },
  viewAllComments: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 11.5, marginTop: 3 },
  fab: { position: 'absolute', right: 22, bottom: BottomTabInset + 8, width: 58, height: 58, borderRadius: 21, overflow: 'hidden', shadowColor: '#7B5CFA', shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, fabGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabMenuOverlay: { flex: 1, backgroundColor: 'rgba(3, 7, 18, 0.12)' },
  fabMenuContainer: { position: 'absolute', right: 22, bottom: BottomTabInset + 76, width: 190, backgroundColor: theme.background, borderRadius: 20, padding: 8, shadowColor: '#241B4D', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 14 },
  fabMenuItem: { paddingVertical: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 13, backgroundColor: theme.backgroundElement, marginVertical: 3 },
  fabMenuText: { color: theme.text, fontFamily: Fonts?.sansMedium, fontSize: 15 },
  emptyFeedCard: { marginTop: 12, padding: 18, borderRadius: 20, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.backgroundSelected },
  emptyFeedTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 },
  emptyFeedText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, marginTop: 6, lineHeight: 19 },

});

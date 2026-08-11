import { Search, UserPlus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { BottomTabInset, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getContactsPermission } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

type Suggestion = {
  id: string;
  name: string;
  avatar: string | null;
  mutual: number;
  status: 'none' | 'pending';
  bio?: string | null;
  username?: string | null;
  source: 'random' | 'contacts';
};

type IncomingRequest = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderUsername?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  bio_status?: string | null;
  phone?: string | null;
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+${digits}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function FindFriendsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [contactsOnApp, setContactsOnApp] = useState<Suggestion[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSuggestions = async () => {
      try {
        const currentProfile = await getCurrentProfile();
        const profileId = currentProfile?.id;

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, bio_status, phone')
          .neq('id', profileId ?? '')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const [{ data: friendshipData, error: friendshipError }, { data: sentRequestData, error: sentRequestError }] = await Promise.all([
          supabase.from('friendships').select('user_a, user_b').or(`user_a.eq.${profileId},user_b.eq.${profileId}`),
          supabase.from('friend_requests').select('recipient_id').eq('sender_id', profileId).eq('status', 'pending'),
        ]);
        if (friendshipError) throw friendshipError;
        if (sentRequestError) throw sentRequestError;

        const connectedIds = new Set((friendshipData ?? []).flatMap((row) => [row.user_a, row.user_b]).filter((id) => id !== profileId));
        const pendingIds = new Set((sentRequestData ?? []).map((row) => row.recipient_id));
        const profiles = ((data as ProfileRow[] | null) ?? []).filter((candidate) => !connectedIds.has(candidate.id) && !pendingIds.has(candidate.id));

        const { data: incomingData, error: incomingError } = await supabase
          .from('friend_requests')
          .select('id, sender_id, profiles!friend_requests_sender_id_fkey(id, full_name, avatar_url, username)')
          .eq('recipient_id', profileId)
          .eq('status', 'pending');

        if (incomingError) throw incomingError;

        const incoming = ((incomingData ?? []) as any[]).map((request) => ({
          id: request.id,
          senderId: request.sender_id,
          senderName: request.profiles?.full_name?.trim() || request.profiles?.username || 'Someone',
          senderAvatar: request.profiles?.avatar_url ?? null,
          senderUsername: request.profiles?.username,
        }));
        const incomingSenderIds = new Set(incoming.map((request) => request.senderId));
        const suggestionProfiles = profiles.filter((candidate) => !incomingSenderIds.has(candidate.id));
        const randomProfiles = shuffle(suggestionProfiles).slice(0, 8).map((profile) => ({
          id: profile.id,
          name: profile.full_name?.trim() || profile.username || 'New user',
          avatar: profile.avatar_url ?? null,
          mutual: Math.floor(Math.random() * 9) + 1,
          status: 'none' as const,
          bio: profile.bio_status,
          username: profile.username,
          source: 'random' as const,
        }));

        const contactsPermission = await getContactsPermission();
        let matchedContacts: Suggestion[] = [];

        if (contactsPermission === 'granted') {
          try {
            const contactsModule = await import('expo-contacts');
            const Contacts = (contactsModule as any).default ?? contactsModule;
            const { data: contactsData } = await Contacts.getContactsAsync({
              fields: [Contacts.Fields.PhoneNumbers],
            });

            const normalizedProfiles = new Map(suggestionProfiles.map((profile) => [normalizePhone(profile.phone), profile]));
            const seen = new Set<string>();

            matchedContacts = (contactsData ?? [])
              .flatMap((contact: any) => (contact.phoneNumbers ?? []).map((entry: any) => ({
                contactName: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
                phone: entry.number,
              })))
              .map((entry: { phone: string; contactName: string }) => ({
                phone: normalizePhone(entry.phone),
                contactName: entry.contactName || 'Contact',
              }))
              .filter(({ phone }: { phone: string }) => phone)
              .map(({ phone, contactName }: { phone: string; contactName: string }) => {
                const matchedProfile = normalizedProfiles.get(phone);
                if (!matchedProfile || seen.has(matchedProfile.id)) return null;
                seen.add(matchedProfile.id);
                return {
                  id: matchedProfile.id,
                  name: matchedProfile.full_name?.trim() || matchedProfile.username || contactName,
                  avatar: matchedProfile.avatar_url ?? null,
                  mutual: 3,
                  status: 'none' as const,
                  bio: matchedProfile.bio_status,
                  username: matchedProfile.username,
                  source: 'contacts' as const,
                };
              })
              .filter(Boolean) as Suggestion[];
          } catch (contactsError) {
            console.warn('[find-friends] contacts lookup failed', contactsError);
          }
        }

        if (active) {
          setSuggestions(randomProfiles);
          setContactsOnApp(matchedContacts);
          setIncomingRequests(incoming);
        }
      } catch (error) {
        console.warn('[find-friends] could not load suggestions', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      active = false;
    };
  }, []);

  const toggleConnect = async (id: string, list: 'suggestions' | 'contacts') => {
    const currentProfile = await getCurrentProfile();
    const profileId = currentProfile?.id;
    if (!profileId) return;

    const target = list === 'suggestions'
      ? suggestions.find((item) => item.id === id)
      : contactsOnApp.find((item) => item.id === id);

    if (!target) return;

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: profileId,
      recipient_id: id,
      status: 'pending',
    });

    if (error) {
      console.warn('[find-friends] request insert failed', error);
      return;
    }

    if (list === 'suggestions') {
      setSuggestions((items) => items.map((item) => (item.id === id ? { ...item, status: 'pending' } : item)));
      return;
    }

    setContactsOnApp((items) => items.map((item) => (item.id === id ? { ...item, status: 'pending' } : item)));
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    const currentProfile = await getCurrentProfile();
    if (!currentProfile?.id) return;

    if (action === 'decline') {
      await supabase.from('friend_requests').delete().eq('id', requestId);
      setIncomingRequests((items) => items.filter((item) => item.id !== requestId));
      return;
    }

    const { data: requestRow, error: fetchError } = await supabase
      .from('friend_requests')
      .select('sender_id, recipient_id')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchError || !requestRow) return;

    await supabase.from('friend_requests').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', requestId);
    await supabase.from('friendships').insert({
      user_a: requestRow.sender_id,
      user_b: requestRow.recipient_id,
    });
    setIncomingRequests((items) => items.filter((item) => item.id !== requestId));
  };

  const filteredSuggestions = suggestions.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const filteredContacts = contactsOnApp.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={styles.container}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>UNIVERSAL</Text>
            <Text style={styles.title}>Find Friends</Text>
          </View>
          <View style={styles.headerIcon}>
            <UserPlus size={20} color={theme.primary} strokeWidth={2} />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={17} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={theme.textSecondary}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.loadingText}>Finding people for you…</Text>
          </View>
        ) : null}

        {incomingRequests.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Incoming requests</Text>
              <View style={styles.countPill}><Text style={styles.countPillText}>{incomingRequests.length}</Text></View>
            </View>
            {incomingRequests.map((request) => (
              <View key={request.id} style={styles.friendRow}>
                <Avatar name={request.senderName} source={request.senderAvatar} styles={styles} size={50} />
                <View style={styles.friendCopy}>
                  <Text style={styles.name}>{request.senderName}</Text>
                  <Text style={styles.meta}>{request.senderUsername ? `@${request.senderUsername}` : 'Wants to connect'}</Text>
                </View>
                <TouchableOpacity style={styles.connectButton} onPress={() => respondToRequest(request.id, 'accept')} activeOpacity={0.85}>
                  <Text style={styles.connectButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pendingButton} onPress={() => respondToRequest(request.id, 'decline')} activeOpacity={0.85}>
                  <Text style={styles.pendingButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}

        {filteredContacts.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>From your contacts</Text>
              <View style={styles.countPill}><Text style={styles.countPillText}>{filteredContacts.length}</Text></View>
            </View>
            {filteredContacts.map((suggestion) => {
              const pending = suggestion.status === 'pending';
              return (
                <View key={suggestion.id} style={styles.friendRow}>
                  <Avatar name={suggestion.name} source={suggestion.avatar} styles={styles} size={50} />
                  <View style={styles.friendCopy}>
                    <Text style={styles.name}>{suggestion.name}</Text>
                    <Text style={styles.meta}>{suggestion.bio || 'Using Universal Chat'} </Text>
                  </View>
                  <TouchableOpacity style={pending ? styles.pendingButton : styles.connectButton} onPress={() => toggleConnect(suggestion.id, 'contacts')} activeOpacity={0.85}>
                    {!pending && <UserPlus size={14} color="#fff" strokeWidth={2.5} />}
                    <Text style={pending ? styles.pendingButtonText : styles.connectButtonText}>{pending ? 'Requested' : 'Connect'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Suggested for you</Text>
          <View style={styles.countPill}><Text style={styles.countPillText}>{filteredSuggestions.length}</Text></View>
        </View>
        {filteredSuggestions.length === 0 ? (
          <Text style={styles.emptyRowText}>No suggestions match your search right now.</Text>
        ) : (
          filteredSuggestions.map((suggestion) => {
            const pending = suggestion.status === 'pending';
            return (
              <View key={suggestion.id} style={styles.friendRow}>
                <Avatar name={suggestion.name} source={suggestion.avatar} styles={styles} size={50} />
                <View style={styles.friendCopy}>
                  <Text style={styles.name}>{suggestion.name}</Text>
                  <Text style={styles.meta}>{suggestion.mutual} mutual connection{suggestion.mutual !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity style={pending ? styles.pendingButton : styles.connectButton} onPress={() => toggleConnect(suggestion.id, 'suggestions')} activeOpacity={0.85}>
                  {!pending && <UserPlus size={14} color="#fff" strokeWidth={2.5} />}
                  <Text style={pending ? styles.pendingButtonText : styles.connectButtonText}>{pending ? 'Requested' : 'Connect'}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={styles.footerHint}>
          <Text style={styles.footerHintText}>We mix people from your contacts and new profiles from the app so discovery feels familiar and social.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Avatar({ name, source, size, styles }: { name: string; source: string | null; size: number; styles: ReturnType<typeof createStyles> }) {
  if (source) {
    return <Image source={{ uri: source }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size * 0.36 }]} />;
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size * 0.36 }]}> 
      <Text style={styles.avatarFallbackText}>{getInitials(name)}</Text>
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

  searchBox: { marginHorizontal: 24, marginTop: 18, borderRadius: 16, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, color: theme.text, fontFamily: Fonts?.sans, fontSize: 14 },

  sectionRow: { marginTop: 26, marginBottom: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 },
  countPill: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  countPillText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 11 },

  friendRow: { marginHorizontal: 24, marginBottom: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendCopy: { flex: 1 },
  name: { color: theme.text, fontFamily: Fonts?.sansSemiBold, fontSize: 15 },
  meta: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 12, marginTop: 2 },

  connectButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, borderRadius: 18, backgroundColor: theme.primary, paddingHorizontal: 14 },
  connectButtonText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 12.5 },
  pendingButton: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: theme.backgroundElement, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  pendingButtonText: { color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 12.5 },

  avatarImage: { backgroundColor: theme.backgroundElement },
  avatarFallback: { backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 16 },
  emptyRowText: { paddingHorizontal: 24, color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 13 },
  footerHint: { marginHorizontal: 24, marginTop: 20, marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: theme.backgroundElement },
  footerHintText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 12.5, lineHeight: 18 },
});

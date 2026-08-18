import { useRouter } from 'expo-router';
import { Search, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContactRecord, createOrGetIndividualChat, getFriendsAndContacts } from '@/lib/chats';

export default function NewChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingChat, setCreatingChat] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await getFriendsAndContacts();
        setContacts(data);
      } catch (error) {
        console.warn('[new_chat] failed to load contacts', error);
      } finally {
        setLoading(false);
      }
    };

    void loadContacts();
  }, []);

  const filteredContacts = contacts.filter((c) => {
    const name = (c.full_name || c.username || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleSelectContact = async (contactId: string) => {
    try {
      setCreatingChat(contactId);
      const chatId = await createOrGetIndividualChat(contactId);
      router.push(`/(chat)/${chatId}`);
    } catch (error) {
      console.warn('[new_chat] failed to create/get chat', error);
      setCreatingChat(null);
    }
  };

  const renderContact = ({ item }: { item: ContactRecord }) => (
    <TouchableOpacity
      style={styles.contactRow}
      onPress={() => void handleSelectContact(item.id)}
      disabled={creatingChat !== null}
      activeOpacity={0.7}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
          <User size={20} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.full_name || item.username || 'Unknown'}</Text>
        <Text style={styles.contactStatus} numberOfLines={1}>
          {item.bio_status || 'Hey there! I am using Universal Chat'}
        </Text>
      </View>
      {creatingChat === item.id && <ActivityIndicator size="small" color={theme.primary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>New Chat</Text>
        <Text style={styles.subtitle}>{contacts.length} contacts</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or username"
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No contacts found</Text>
          <Text style={styles.emptySubtext}>
            {contacts.length === 0 ? 'Add friends to start chatting' : 'Try a different search'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 20, paddingVertical: 16 },
    title: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 28, letterSpacing: -0.5 },
    subtitle: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 13, marginTop: 4 },
    searchContainer: { marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 8 },
    searchInput: { flex: 1, color: theme.text, fontFamily: Fonts?.sans, fontSize: 14, paddingVertical: 6 },
    listContent: { paddingHorizontal: 20, paddingBottom: BottomTabInset + 20 },
    contactRow: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.backgroundElement },
    avatar: { width: 48, height: 48, borderRadius: 16 },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    contactInfo: { flex: 1 },
    contactName: { color: theme.text, fontFamily: Fonts?.sansMedium, fontSize: 15 },
    contactStatus: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 12, marginTop: 2 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 },
    emptySubtext: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, marginTop: 6 },
  });

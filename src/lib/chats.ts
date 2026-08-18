import { getCurrentProfile, ProfileRecord } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export interface ChatRecord {
  id: string;
  type: 'individual' | 'group';
  name?: string | null;
  created_at: string;
  last_message?: string | null;
  last_message_time?: string | null;
  updated_at?: string | null;
  chat_type?: string;
  group_name?: string | null;
  other_user?: ProfileRecord | null;
  last_message_content?: string | null;
  last_message_sender_id?: string | null;
  last_message_created_at?: string | null;
  last_message_status?: 'sent' | 'delivered' | 'read' | null;
  unread_count?: number;
  participants?: {
    profile_id: string;
    profiles?: ProfileRecord;
  }[];
}

export interface ContactRecord {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio_status?: string | null;
  last_seen?: string | null;
}

export async function getFriendsAndContacts(): Promise<ContactRecord[]> {
  const profile = await getCurrentProfile();
  if (!profile?.id) {
    throw new Error('No profile found');
  }

  // Get friends from friendships table
  const { data: friendsData, error: friendsError } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`);

  if (friendsError) {
    throw friendsError;
  }

  const friendIds = (friendsData ?? []).flatMap((row: any) => [row.user_a, row.user_b]).filter((id: string | null) => id && id !== profile.id);
  const uniqueFriendIds = Array.from(new Set(friendIds));

  if (uniqueFriendIds.length === 0) {
    return [];
  }

  // Get all profiles
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio_status, last_seen')
    .in('id', uniqueFriendIds);

  if (profilesError) {
    throw profilesError;
  }

  return (profilesData as ContactRecord[] | null) ?? [];
}

export async function getChatsForUser(): Promise<ChatRecord[]> {
  const { data, error } = await supabase.rpc('get_chat_summaries');
  if (error) throw error;
  return ((data as ChatRecord[] | null) ?? []).map((chat) => ({
    ...chat,
    chat_type: chat.type,
    group_name: chat.type === 'group' ? chat.name : null,
    updated_at: chat.last_message_time || chat.created_at,
  }));
}

export async function createOrGetIndividualChat(participantId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_individual_chat', { other_user_id: participantId });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('The chat could not be opened.');
  return data;
}

export interface ChatRoomDetails {
  id: string;
  type: 'individual' | 'group';
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
  allow_members_send: boolean;
  current_user_role: 'admin' | 'member';
  participants: (ProfileRecord & {
    last_read_at?: string | null;
    last_delivered_at?: string | null;
  })[];
}

export interface MessageRecord {
  id: string;
  chat_id: string;
  sender_id: string;
  content_type: 'text' | 'image' | 'voice' | 'sticker';
  content: string;
  created_at: string;
}

export async function getChatRoom(chatId: string): Promise<ChatRoomDetails> {
  const { data, error } = await supabase.rpc('get_chat_room', { chat_id_input: chatId });
  if (error) throw error;
  if (!data) throw new Error('Chat not found.');
  return data as ChatRoomDetails;
}

export async function getChatMessages(chatId: string): Promise<MessageRecord[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data as MessageRecord[] | null) ?? [];
}

export async function sendChatMessage(chatId: string, content: string): Promise<MessageRecord> {
  const profile = await getCurrentProfile();
  if (!profile?.id) throw new Error('No profile found');
  const { data, error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: profile.id, content_type: 'text', content: content.trim() }).select('*').single();
  if (error) throw error;
  return data as MessageRecord;
}

export async function getUnreadMessageCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_message_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markChatRead(chatId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { target_chat_id: chatId });
  if (error) throw error;
}

export async function markChatDelivered(chatId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_delivered', { target_chat_id: chatId });
  if (error) throw error;
}

export async function markAllChatsDelivered(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_chats_delivered');
  if (error) throw error;
}

export async function uploadGroupImage(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile?.id) throw new Error('No profile found');
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${profile.id}/group-${Date.now()}.${extension}`;
  const response = await fetch(uri);
  const file = await response.arrayBuffer();
  const { error } = await supabase.storage.from('group-images').upload(path, file, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return supabase.storage.from('group-images').getPublicUrl(path).data.publicUrl;
}

export async function createGroupChat(input: {
  name: string; participantIds: string[]; description?: string; imageUrl?: string | null;
  membersCanEdit: boolean; membersCanSend: boolean; membersCanAdd: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_chat', {
    group_name: input.name.trim(), participant_ids: input.participantIds,
    group_description: input.description?.trim() || null, group_image_url: input.imageUrl || null,
    members_can_edit: input.membersCanEdit, members_can_send: input.membersCanSend, members_can_add: input.membersCanAdd,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('The group could not be created.');
  return data;
}
